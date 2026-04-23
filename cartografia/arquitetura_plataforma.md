# Arquitetura da Plataforma Nadia

**Data:** Abril de 2026
**Contexto:** Decisões arquiteturais tomadas ao pensar a evolução de Nadia de produto único para plataforma multi-instância.

---

## Princípio central

> **O dado vive no servidor. O browser só exibe.**

A arquitetura zero-backend foi uma escolha pragmática para o produto inicial (Nadia PIESP). Para uma plataforma com múltiplas Nadias temáticas, um servidor é inevitável e correto.

---

## A stack de dados escolhida

```
Dado bruto (SQL Server, CSV, etc.)
  → exportado para Parquet
      → DuckDB lê o Parquet
          → MCP Server expõe as tools
              → Agentes (Hermes, Claude Desktop, Nadia web)
```

### Parquet — formato de armazenamento

- Formato de arquivo colunar aberto, gratuito, sem servidor
- Lido nativamente por DuckDB, pandas, Spark e qualquer ferramenta de dados
- Exportação simples a partir de qualquer fonte (SQL Server, CSV, etc.):

```python
df = pd.read_sql("SELECT * FROM tabela", conn)
df.to_parquet("dados.parquet")
```

- **É a fonte de verdade.** Quem atualiza o Parquet, atualiza para todos os clientes.

### DuckDB — motor de consulta

- Não é um banco de dados servidor — é uma biblioteca que lê arquivos
- Otimizado para queries analíticas (OLAP): agregações, filtros, GROUP BY
- Sem instalação de servidor, sem configuração, sem licença
- 17 milhões de linhas: sub-segundo para a maioria das queries

**Parquet e DuckDB são complementares, não alternativos:**
- Parquet = onde o dado fica
- DuckDB = o motor que lê e consulta

### MCP Server — interface para os agentes

- Expõe tools com parâmetros estruturados
- O LLM nunca escreve SQL — preenche parâmetros, o servidor gera o SQL
- Lê o Parquet via DuckDB e retorna JSON

---

## Por que não text-to-SQL

Text-to-SQL (deixar o LLM gerar queries SQL livremente) é não-confiável:
- Modelos alucinam nomes de colunas
- Geram JOINs incorretos
- Resultados não-determinísticos

A alternativa adotada: **tools com parâmetros estruturados**. O LLM preenche `{ municipio: "Santos", ano: 2025 }` — o servidor gera o SQL deterministicamente.

```
❌ LLM gera: SELECT * FROM piesp WHERE municipio = 'Santos' AND ano = 2025
✅ LLM chama: consultar_projetos({ municipio: "Santos", ano: 2025 })
   Servidor gera: SELECT * FROM 'dados.parquet' WHERE municipio = ? AND ano = ?
```

---

## Por que Nadias temáticas, não uma Nadia completa

Uma Nadia com acesso a múltiplos MCPs simultaneamente produziria análises mais ricas — mas com custo de latência inaceitável para voz.

Cada MCP adicional é uma tool call adicional. Em análise multissetorial:

```
consultar_piesp() → aguarda → consultar_emprego() → aguarda → consultar_municipios() → responde
      (silêncio)                    (silêncio)                      (silêncio)
```

Três silêncios encadeados antes de o usuário ouvir qualquer coisa.

Com Nadias temáticas, cada instância tem um único MCP — um silêncio só, previsível e controlado.

**A análise multissetorial fica para canais sem restrição de latência** — Hermes no Telegram, Claude Desktop — onde múltiplos MCPs em paralelo são viáveis.

---

## Gap de latência na voz — é estrutural

O gap que o usuário sente na voz não depende da escolha de backend. É inerente ao function calling:

```
Usuário fala → STT → modelo decide chamar tool → (silêncio) → tool executa → modelo responde → TTS
```

DuckDB, Parquet, SQL Server — todos executam em < 100ms. O silêncio vem do ciclo de raciocínio do modelo, não da execução da query. A escolha de backend não resolve o gap de voz.

---

## Por que não PostgreSQL ou SQL Server

| | DuckDB | PostgreSQL | SQL Server |
|---|---|---|---|
| Tipo | OLAP | OLTP | OLTP |
| Custo | Gratuito | Gratuito | Caro |
| Operação | Arquivo numa pasta | Servidor dedicado | Servidor dedicado |
| Analytics | Excelente | Mediano | Mediano |
| Treinamento de equipe | Mínimo | Complexo | Complexo |

Nadia é workload 100% OLAP (só lê, nunca escreve). PostgreSQL e SQL Server são otimizados para OLTP. Usar PostgreSQL não seria mais maduro — seria a ferramenta errada.

---

## Quando considerar ClickHouse

ClickHouse é um banco de dados analítico open source, gratuito, otimizado para bilhões de linhas.

Considerar apenas se o volume ultrapassar **500 milhões a 1 bilhão de linhas** com queries complexas e múltiplos usuários simultâneos.

Com 17 milhões de linhas, DuckDB está 30 a 50 vezes abaixo do limite onde começaria a sentir pressão. ClickHouse é o próximo degrau, não o degrau atual.

---

## LLM e voz — Gemini permanece

**Gemini 2.5 Flash** continua como LLM principal. Nenhum outro modelo oferece os três juntos:
- Live API para voz conversacional com baixa latência
- Function calling para consultas estruturadas
- Google Search grounding para dossiês de empresas

**ElevenLabs não substitui o Gemini para voz conversacional.** ElevenLabs é TTS (texto para voz) — exigiria uma pipeline de três componentes separados:

```
❌ Voz do usuário → Whisper (STT) → LLM → ElevenLabs (TTS) → resposta
✅ Voz do usuário → Gemini Live (tudo em um) → resposta
```

A qualidade de voz do ElevenLabs é superior, mas o gap de latência seria inaceitável para conversa. ElevenLabs faz sentido apenas para narração unidirecional (leitura de relatórios).

---

## O que mudaria se começássemos do zero

| Decisão | Mudaria? | Por quê |
|---|---|---|
| Gemini como LLM | Não | Live API + function calling + grounding |
| React + TypeScript | Não | Stack sólida |
| Zero-backend | Sim | Dívida técnica para plataforma multi-Nadia |
| CSVs no bundle | Sim | Parquet + DuckDB + MCP desde o início |
| Dois sistemas de design (MUI + Tailwind) | Sim | Só Tailwind |

---

## Sequência de implementação recomendada

```
1. Nadia Receita Federal  → primeira experiência com Parquet + DuckDB + MCP
2. Nadia Emprego          → seade-trabalho-mcp (maior cruzamento com PIESP)
3. Nadia Municípios       → síntese dos domínios via Hermes
```

A Nadia Receita Federal é o projeto piloto ideal: dado já disponível em tabelão único, volume conhecido (17M linhas), queries analíticas simples a moderadas.
