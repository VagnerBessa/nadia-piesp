# Ecossistema Nadia — Arquitetura Técnica

**Data:** Abril de 2026
**Contexto:** Visão técnica do ecossistema de IA do Seade. Para a discussão sobre marca e posicionamento organizacional, ver `marca_nadia.md`.

---

## Modelo conceitual: Nadia como sistema de canais

Nadia não é uma aplicação — é um sistema com três canais de acesso, cada um com motor e propósito diferentes.

```
┌──────────────────────────────────────────────────────────┐
│                        NADIA                             │
│                Sistema de IA do Seade                    │
├──────────────┬─────────────────┬────────────────────────-┤
│  Nadia Web   │  Nadia Mobile   │       Nadia API          │
│              │                 │                          │
│  Browser     │  Telegram       │  MCP servers             │
│  Gemini 2.5  │  Slack          │  Protocolo aberto        │
│  Dashboards  │  WhatsApp       │  Qualquer consumidor     │
│  Voz         │                 │                          │
│              │  Motor: Hermes  │                          │
└──────────────┴─────────────────┴──────────────────────────┘
                        │               │
              ┌─────────┴───────────────┘
              ▼
┌─────────────────────────────────────────────────────┐
│               CAMADA MCP (dados do Seade)           │
│                                                     │
│  seade-economia-mcp    seade-trabalho-mcp           │
│  seade-indices-mcp     seade-demografia-mcp         │
└─────────────────────────────────────────────────────┘
```

---

## O que cada canal entrega

**Nadia Web** — profundidade analítica, interface rica
- Dashboards generativos (Data Lab), relatórios, gráficos Recharts
- Voz via Gemini Live API
- Chat com function calling determinístico
- Sem memória entre sessões — cada análise começa do zero

**Nadia Mobile (Hermes)** — abrangência e continuidade
- Acesso via Telegram, Slack, WhatsApp — qualquer dispositivo
- Memória persistente: lembra conversas e padrões de cada analista
- Loop de aprendizagem: cria skills a partir de boas respostas, melhora com o uso
- Respostas cruzadas entre domínios numa única conversa

**Nadia API (MCP servers)** — infraestrutura agnóstica
- Dados do Seade expostos via Model Context Protocol
- Consumíveis por qualquer cliente: Claude Desktop, Cursor, scripts, Power BI
- Não são "da Nadia" — são do Seade, e sobrevivem a qualquer troca de tecnologia de IA

---

## Princípio de design

> **Dado vive no domínio que o produz. Perfil municipal é sempre síntese da inteligência. A marca (Nadia) é mais durável que a tecnologia que a sustenta.**

Cada indicador — PIB, IDH, IPRS, emprego — pertence ao domínio que o produz e ao seu MCP server correspondente. Não existe "base municipal": quando um analista pergunta sobre Campinas, o Hermes consulta múltiplos MCPs e sintetiza a resposta. O dado não é duplicado; a inteligência faz a síntese.

---

## Estrutura dos MCP servers

Um MCP server por domínio temático — não por CSV, não por tabela:

| Servidor | Domínio | Dono | Ciclo |
|---|---|---|---|
| `seade-economia-mcp` | PIESP, PIB, produção industrial | Contas Regionais + PIESP | Anual/Trimestral |
| `seade-trabalho-mcp` | Emprego formal, desemprego, salários | Mercado de Trabalho | Mensal |
| `seade-indices-mcp` | IPRS, IDH, IVJ | Índices e Indicadores | Variável |
| `seade-demografia-mcp` | População, migrações, domicílios | Estatísticas Populacionais | Anual/Decenal |

O critério de agrupamento é quem produz e quem atualiza — times diferentes, ciclos diferentes, propriedade diferente.

---

## O Hermes é permanente, não uma fase futura

O Hermes conecta via protocolo MCP, não via tecnologia de armazenamento. O que está atrás do MCP server — CSV, SQLite, SQL Server — é transparente para ele. Pode ser conectado hoje, com os dados atuais em CSV.

```
Fase 1: CSV    →  MCP server lê CSV         ← Hermes conectado ✓
Fase 2: DuckDB →  MCP server lê .db         ← Hermes conectado ✓ (mesma URL)
Fase 3: Remoto →  MCP server centralizado   ← Hermes conectado ✓ (mesma URL)
Fase 4: SQL    →  MCP server lê SQL Server  ← Hermes conectado ✓ (mesma URL)
```

A evolução do armazenamento não afeta o Hermes. A interface MCP é o ponto fixo.

---

## Estado atual de implementação

| Canal | Status |
|---|---|
| Nadia Web (PIESP) | ✅ Implementado — chat, voz, dashboards, Data Lab |
| MCP server PIESP | ✅ Implementado — stdio + HTTP/SSE, 5 tools |
| Nadia Mobile (Hermes) | ⬜ Aguarda deploy em servidor do Seade |
| seade-trabalho-mcp | ⬜ A construir |
| seade-indices-mcp | ⬜ A construir |
| seade-demografia-mcp | ⬜ A construir |
