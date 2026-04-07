# CLAUDE.md — Histórico de Decisões e Contexto do Projeto

Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão.
Registra decisões arquiteturais, lições aprendidas e features implementadas.

---

## Visão Geral do Projeto

**Nadia-PIESP** é um assistente de IA da Fundação Seade para análise de investimentos no Estado de São Paulo, baseado nos dados da PIESP (Pesquisa de Investimentos no Estado de São Paulo).

- **Stack:** React 19 + TypeScript + Vite, Material-UI + Tailwind CSS
- **IA:** Google Gemini 2.5 Flash (chat e relatórios), Gemini Live API (voz)
- **Dados:** CSVs do PIESP em `knowledge_base/` (importados como `?raw` via Vite)

---

## Lições Aprendidas: Contexto Longo vs Dados Tabulares

**Data:** Abril de 2026.
**Objetivo do Teste:** Verificar se é viável carregar a base completa da PIESP diretamente na janela de contexto do Gemini Flash Native Audio sem RAG ou Function Calling.

### Resultados

1. **Viabilidade Técnica (WebSocket):** Injetar megabytes de dados via WebSocket em navegadores falha por limites de frames (Chrome bloqueia a conexão). Contornado criando `piesp_mini.csv` (~1 MB, sem a coluna `descr_investimento`).

2. **"Colapso da Atenção" em Agregações:** Com contexto longo carregado, a Nadia alucinava ao responder perguntas analíticas como "cite os principais investimentos em 2026". LLMs não agem como bancos de dados SQL — com 5.000 linhas de texto tabular denso, a atenção se dilui, o modelo tenta adivinhar/interpolar e gera respostas incorretas.

### A Solução: Function Calling

Abandonamos o contexto longo para tabelas e implementamos **Function Calling (Tools)**:
- `piespDataService.ts` — motor de filtro determinístico (CSV parser + array map)
- A IA é instruída a nunca adivinhar: chama `consultar_projetos_piesp` com os argumentos, filtramos os resultados em JavaScript e devolvemos o JSON compacto
- Resultado: precisão de 100% com latência baixa

### Regra de Ouro

| Tipo de conteúdo | Estratégia | Por quê |
|---|---|---|
| Texto narrativo (metodologia, regras, manuais) | Contexto longo (`systemInstruction`) | LLMs compreendem e evocam prosa com excelência |
| Dados tabulares / CSV / planilhas | Function Calling (Tools) | LLMs falham em filtrar, agregar e rankear linhas numéricas densas |
| Dados pequenos (< 50 linhas, dicionários) | Contexto longo | Volume insignificante, sem risco de diluição de atenção |

### Cronologia de Problemas e Soluções

**Problema 1 — WebSocket recusado ("Não foi possível se conectar com Nadia")**
Causa: `piesp_confirmados_com_valor.csv` (2,1 MB) injetado inteiro na `systemInstruction`. Browser rejeitava o frame inicial.
Solução: Criamos `piesp_mini.csv` (~1 MB) e `piesp_micro.csv` (300 linhas para debug).

**Problema 2 — API Key bloqueada (`API_KEY_SERVICE_BLOCKED`)**
Causa: Chave herdada do Nadia-2 sem permissão para a Generative Language API.
Solução: Nova chave gerada no Google AI Studio com permissões corretas.

**Problema 3 — Tela em branco após troca de chave**
Causa: Chave colada sem aspas no `config.ts` — TypeScript interpretou como expressão aritmética.
Solução: Envolver os valores das constantes com aspas duplas.

**Problema 4 — Nadia conecta mas alucina os dados**
Causa: Contexto longo com dados tabulares causa diluição de atenção (ver acima).
Solução: Function Calling com `piespDataService.ts`.

**Problema 5 — Expansão de escopo (nova base + metodologia)**
Solução arquitetural:
- Metodologia → Contexto longo (texto narrativo)
- Nova tabela CSV → Nova tool (`consultar_anuncios_sem_valor`)
- UX: instrução de apresentação da base secundária apenas na primeira fala, sem repetição

---

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                 NAVEGADOR (Chrome)                   │
│                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────┐ │
│  │ Microfone│──▶│  VoiceView   │──▶│ useLive     │ │
│  │  (Audio) │   │  .tsx        │   │ Connection  │ │
│  └──────────┘   │  onToolCall  │   │ .ts         │ │
│                 │  handler ────┼──▶│ WebSocket   │ │
│                 └──────┬───────┘   │ (Gemini     │ │
│                        │           │  Live API)  │ │
│                        ▼           └──────┬──────┘ │
│              ┌─────────────────┐          │        │
│              │ piespDataService│◀─────────┘        │
│              │ .ts             │  (tool response)  │
│              └─────────────────┘                   │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ prompts.ts (SYSTEM_INSTRUCTION)             │    │
│  │  ├── Persona Nadia                          │    │
│  │  ├── Metodologia PIESP (contexto longo) ✓   │    │
│  │  └── Dicionário de Variáveis (contexto) ✓   │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## Estrutura de Views

| View | Rota (`App.tsx`) | Descrição |
|---|---|---|
| `LandingPage` | `home` | Página inicial |
| `VoiceView` | `voice` | Conversa por voz (Gemini Live API) |
| `ChatView` | `chat` | Chat texto com function calling |
| `PiespDashboardView` | `dashboards` | Dashboard com gráficos Recharts |
| `PerfilMunicipalView` | `municipal` | Mapa 3D + voz para municípios |
| `UploadView` | `upload` | Publicação de arquivos |
| `ExplorarDadosView` | `explorar` | Relatórios analíticos por filtro *(abril/2026)* |
| `PerfilEmpresaView` | `perfil-empresa` | Dossiê de empresa com web search *(abril/2026)* |

---

## Decisões Arquiteturais

### Function calling: PIESP vs Google Search (não podem ser combinados)
As ferramentas `piespTools` (function calling local) e `searchTools` (Google Search grounding) **não podem ser usadas na mesma chamada** da Gemini API. A lógica em `useChat.ts` detecta a skill e escolhe qual conjunto usar. Nas novas views (`ExplorarDadosView`, `PerfilEmpresaView`), cada uma usa diretamente a ferramenta adequada sem passar pelo `useChat`.

### CSV parseado em runtime
Os arquivos CSV do PIESP são importados como string raw (`?raw`) e parseados no browser. Não há backend. O cache de `getDashboardData()` em `piespDashboardData.ts` é estático (módulo singleton) para evitar reparsing.

### Separação: `piespDataService` vs `piespDashboardData`
- `piespDataService.ts` — filtragem e busca por registro (consultas pontuais, function calling)
- `piespDashboardData.ts` — agregação completa para gráficos (single-pass, cached)

---

## Features Implementadas

### Abril/2026 — Branch `claude/add-data-exploration-reports-5yplM`

#### Aba "Explorar Dados" (`ExplorarDadosView.tsx`)

Filtros por setor, região, ano e tipo de investimento → relatório analítico gerado pela Nadia.

**Como funciona:**
1. Filtros populados via `getMetadados()` (listas únicas extraídas do CSV)
2. Preview em tempo real do número de projetos encontrados
3. Ao clicar "Gerar Relatório": `filtrarParaRelatorio()` localmente → dados serializados no prompt → Gemini gera o relatório → exibido via `MarkdownRenderer`
4. Chamada direta ao Gemini (sem function calling), pois os dados já foram filtrados localmente

**Funções novas em `piespDataService.ts`:**
- `filtrarParaRelatorio(filtro)` — filtro estendido (setor, região, ano, tipo) com agregações
- `getMetadados()` — listas únicas de setores, regiões, anos e tipos

#### Aba "Perfil de Empresa" (`PerfilEmpresaView.tsx`)

Dossiê completo combinando dados internos do PIESP com pesquisa na internet, incluindo desempenho financeiro.

**Como funciona:**
1. Campo de busca com autocomplete (empresas presentes no PIESP)
2. `buscarEmpresaNoPiesp()` localmente → prompt com dados PIESP → Gemini com `googleSearch`
3. Prompt instrui busca ativa de: perfil corporativo, **dados financeiros** (receita, EBITDA, lucro, dívida, market cap, rating de crédito), posição de mercado, fatos recentes
4. Citações inline extraídas de `groundingSupports` e injetadas via `injectInlineCitations()`
5. Renderizado pelo `DossieRenderer` (componente local): headers `##`/`###`, tabelas markdown, listas, badges de citação clicáveis com tooltip

**Funções novas em `piespDataService.ts`:**
- `getUniqueEmpresas()` — lista ordenada de empresas únicas para autocomplete
- `buscarEmpresaNoPiesp(nome)` — busca por nome (e investidora), sem limite de resultados

#### Geração de Gráficos Nativos na Resposta da IA (Recharts)

Ensinamos a Nadia a inserir gráficos (Linha, Barra e Pizza) de maneira dinâmica no meio de seu texto final nas abas Explorar e Dossiê.
- Um novo componente (`EmbeddedChart.tsx`) com Recharts intercepta blocos markdown estruturados como \`\`\`json-chart\`\`\` e os substitui por UI visual sem rebarbas.
- Metadados cronológicos foram preparados pelo `piespDataService.ts` usando a nova função de agregação `agruparAno()`.
- **Lição Aprendida (Engenharia de Prompt):** A Inteligência Artificial é bastante focada no *mínimo esforço necessário*. Quando a instrução dizia "Se julgar visualmente útil, insira um gráfico", a IA formatava apenas 1 gráfico de barras com as Cidades e ignorava todo o resto. Para contornar, alteramos os prompts para uma **ordem estrita**, exigindo "pelo menos 2 a 3 gráficos de frentes diferentes", incluindo obrigações (`line` estritamente para evolução temporal, `bar` para volume comparativo, `pie` para proporção/market share).

#### Sanitização de UTF-8 no Sistema de Citações do Dossiê
- **O Bug:** Como a fonte bibliográfica (Google Grounding API) nos dossiês injetava a bolinha `[N]` no meio de palavras com acento (Ex: "Funda 8 ção").
- **Solução:** O `endIndex` retornado pela API baseia-se em **Bytes UTF-8**, enquanto o Javascript (TypeScript) lê os tamanhos de string em **Caracteres UTF-16**. A diferença na contagem fazia a citação retroceder cortando palavras. Corrigido ao envolver o texto via `TextEncoder / Decoder` atuando num Slice de uma matriz `Uint8Array`.

---

## Convenções

- Novas views: prop `onNavigateHome: () => void`, header interno próprio, botão "Voltar"
- Navegação centralizada em `App.tsx` (state machine com `useState<View>`)
- `Header.tsx` recebe callbacks opcionais — adicionar prop ao interface ao incluir nova view
- Tailwind dark-first; paleta: `slate-*` fundos/texto, `rose-*` destaques/ações, `sky-*` links/citações
