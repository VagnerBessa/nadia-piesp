# Arquitetura do Ecossistema Seade — Nadia + Hermes

> Documento de discussão arquitetural. Registra decisões, limitações descobertas
> e princípios que guiam a evolução do projeto.
> Última atualização: abril/2026

---

## 1. Estado Atual

Uma única aplicação web. O dado fica preso dentro dela.

```
Usuário
   ↓
Nadia Web (React + Gemini)
   ↓
piespDataService.ts
(lê CSV direto no navegador via Vite ?raw)
   ↓
Resposta
```

**Problema central:** quando surgem múltiplos aplicativos (Nadia Municípios,
Nadia Trabalho, Hermes), cada um precisaria de sua própria cópia do CSV e
da lógica de filtro. Qualquer atualização exige sincronizar N lugares.

---

## 2. O Ecossistema Alvo

```
                    ┌──────────────────────────────┐
                    │       SERVIDOR SEADE          │
                    │                              │
                    │  seade-economia-mcp          │
                    │  (PIESP, PIB, produção)      │
                    │                              │
                    │  seade-trabalho-mcp          │
                    │  (CAGED, PNAD)               │
                    │                              │
                    │  seade-municipios-mcp        │
                    │  (data mart municipal)       │
                    │                              │
                    │  seade-demografia-mcp        │
                    │  (população, migrações)      │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ↓                ↓                ↓
         Nadia PIESP    Nadia Municípios      Hermes
         (web)          (web / voz)      (Telegram / WhatsApp)
         1 MCP          N MCPs           todos os MCPs
```

**Princípio:** o dado vive no MCP, não no cliente. Os clientes são
intercambiáveis.

---

## 3. Especialista vs Generalista — não é tipo, é configuração

A distinção não é entre tipos de Nadia. É quantos MCPs aquele cliente conecta.

| Cliente | MCPs conectados | Exemplo de pergunta |
|---|---|---|
| Nadia PIESP | 1 (economia) | "Qual o maior investimento em 2024?" |
| Nadia Municípios | 3 (economia + trabalho + demo) | "Como está Campinas?" |
| Hermes | Todos | "Compare Campinas e Santos em emprego e investimento" |

A mesma arquitetura serve os dois casos. A diferença é configuração, não código.

---

## 4. DuckDB — por que é a escolha para cada MCP

Cada MCP server usa DuckDB como armazenamento interno.

| Critério | SQLite | DuckDB | PostgreSQL |
|---|---|---|---|
| Instalação | Embutido | `npm install duckdb` | Servidor dedicado |
| Consultas analíticas (GROUP BY, SUM) | Lento (row-oriented) | Rápido (column-oriented) | Rápido |
| Leitura direta de CSV | Não | Sim (`READ_CSV_AUTO`) | Não |
| Escrita concorrente | Limitada | Sessão única | Alta |
| Perfil PIESP / CAGED | OK | Ótimo | Excessivo |

**Vantagem decisiva:** migração de CSV para DuckDB sem ETL.

```sql
-- DuckDB lê o CSV diretamente, sem importação
SELECT setor, SUM(valor)
FROM read_csv_auto('piesp.csv')
GROUP BY setor
```

A Fase 2 (CSV → DuckDB) é uma refatoração de horas, não semanas.

---

## 5. Agente vs Function Calling — impacto em cada canal

### Chat escrito

O loop de agente (Gemini chama tool → recebe resultado → decide chamar outra)
adiciona ~1-2s por ciclo. Administrável com um indicador de "consultando dados...".

### Voz — a limitação central

A Live API (WebSocket) pausa o áudio a cada chamada de tool. O usuário ouve
silêncio. Dois ou três silêncios numa resposta de voz parecem queda de conexão.

**Regra:** em voz, minimizar ao máximo o número de chamadas de tool.

---

## 6. Estratégias de dados para voz

### 6.1 Injeção no systemInstruction (zero pausa)

Dados injetados antes de abrir o WebSocket. Gemini os tem disponíveis sem
nenhuma chamada de tool.

**Funciona quando:** o contexto é conhecido antes da conversa — por exemplo,
o usuário selecionou um município numa tela anterior.

**Limites práticos:**

| Escopo | Tamanho estimado | Viável? |
|---|---|---|
| 1 município, 26 anos, 30 indicadores | ~20KB | Sim — série completa funciona |
| 645 municípios, 5 anos, KPIs compactos | ~240KB | Limite prático |
| 645 municípios, 26 anos | ~1,2MB | Chrome bloqueia o WebSocket frame |

**Conclusão:** injeção funciona para escopo municipal único. Para todos os
municípios com série histórica completa, não é viável.

### 6.2 Tool calling com 1 pausa (pausa única tolerável)

O LLM chama uma tool, recebe os dados, responde. Uma pausa perceptível mas
aceitável se comunicada ao usuário ("Nadia está consultando os dados...").

**Arquitetura correta: 1 MCP com parâmetro — não 645 MCPs.**

```
// Errado: 645 ferramentas no contexto (as definições sozinhas
//         já consomem 80-100KB de contexto)
mcp_campinas(), mcp_santos(), mcp_sorocaba()...

// Certo: 1 ferramenta, município como argumento
consultar_municipio(nome: "Campinas", indicadores: [...], anos: [...])
```

O LLM extrai o município da fala do usuário e passa como parâmetro.
Resultado idêntico, arquitetura sustentável.

### 6.3 Data mart municipal (compromisso entre as duas)

Tabela pré-agregada com os principais indicadores por município, construída
via ETL periódico a partir de múltiplas fontes.

```
ETL (roda na atualização das fontes)
  PIESP + CAGED + IBGE → tabela municipios_perfil no DuckDB
                              ↓
                    seade-municipios-mcp
                              ↓
         consultar_municipio("Campinas") → 1 linha, dados prontos
```

**Vantagem:** uma única chamada de tool retorna dados consolidados de múltiplas
fontes. Sem agente, sem múltiplas pausas.

**Trade-off consciente:** a tabela só contém indicadores decididos em design time.
Adicionar um novo indicador exige reprocessar o ETL. Para um perfil municipal
com escopo definido (investimento, emprego, população, PIB), essa troca vale a pena.

---

## 7. Tabela de decisão para voz

| Situação | Solução | Pausa? |
|---|---|---|
| 1 município, dados simples, contexto pré-selecionado | Injeção no systemInstruction | Não |
| 1 município, série histórica completa, voz livre | Tool calling, 1 MCP com parâmetro | 1 pausa |
| Comparação entre municípios | Tool calling, 1 MCP com parâmetro | 1 pausa |
| Pergunta imprevisível, múltiplas fontes | Tool calling, aceitar pausa | 1+ pausas |
| 645 municípios × 26 anos injetados | Inviável (WebSocket bloqueado) | — |
| 645 MCPs separados | Inviável (definições consomem contexto) | — |

**Conclusão geral:** para voz com dados históricos em escala municipal,
a pausa de uma única chamada de tool é inevitável. O objetivo é garantir
que seja sempre uma única pausa, não várias.

---

## 8. Hermes — o orquestrador multi-canal

O Hermes não é uma fase da evolução. É um cliente paralelo que pode se
conectar aos MCPs desde a Fase 2.

**Diferença dos outros clientes:**
- Canal: Telegram / WhatsApp (não web)
- Scope: todos os MCPs disponíveis
- Perguntas: imprevisíveis — o usuário pode perguntar qualquer coisa

**Para perguntas compostas**, o Hermes precisa de loop de agente:

```
Usuário: "Como está Campinas em emprego e investimento?"
         ↓
Hermes chama economia-mcp("Campinas")     ← chamada 1
Hermes chama trabalho-mcp("Campinas")     ← chamada 2 (paralela)
         ↓
Sintetiza e responde
```

Em texto (Telegram), as chamadas paralelas são invisíveis ao usuário.
Um indicador de "digitando..." resolve a UX.

---

## 9. Trajetória de evolução

```
Fase 1 — Hoje
  Nadia Web lê CSV no navegador via piespDataService.ts
  MCP experimental em mcpService.ts (papel/celulose, não integrado)

Fase 2 — Próximo passo
  seade-economia-mcp com DuckDB substituindo o CSV local
  Nadia Web consulta o MCP (function calling remoto)
  Hermes pode se conectar ao mesmo MCP desde já
  Roda localmente ou num servidor simples do Seade

Fase 3
  seade-municipios-mcp com data mart consolidado
  seade-trabalho-mcp, seade-demografia-mcp entram
  Hermes orquestra múltiplos MCPs
  Todos os clientes apontam para o servidor Seade

Fase 4
  DuckDB substituído por SQL Server / PostgreSQL corporativo
  Os MCPs continuam os mesmos — só a fonte de dados muda
  Clientes não percebem a troca
```

**Hermes é paralelo, não uma fase.** Conecta desde a Fase 2.

---

## 10. Decisões em aberto

| Decisão | Opções | Status |
|---|---|---|
| Protocolo do MCP | HTTP-SSE (múltiplos clientes) vs stdio (Claude Desktop) | Em aberto |
| Primeiro MCP a implementar | seade-economia-mcp (continuidade com PIESP) | Provável |
| Orquestração do Hermes | Parallel tool calling vs loop de agente | Em aberto |
| Comunicação da pausa em voz | Animação + "consultando dados..." | A definir UX |
