# CLAUDE.md — Contexto do Projeto

Lido automaticamente pelo Claude Code no início de cada sessão.
Para detalhes, ver `docs/`.

---

## Visão Geral

**Nadia-PIESP** — assistente de IA da Fundação Seade para análise de investimentos no Estado de São Paulo (PIESP).

- **Stack:** React 19 + TypeScript + Vite, Material-UI + Tailwind CSS
- **IA:** Google Gemini 2.5 Flash (chat e relatórios), Gemini Live API (voz)
- **Dados:** CSVs do PIESP em `knowledge_base/` (importados como `?raw` via Vite)
- **Sem backend** — app puramente frontend

---

## Regra de Ouro: Dados Tabulares vs Contexto Longo

| Tipo de conteúdo | Estratégia | Por quê |
|---|---|---|
| Texto narrativo (metodologia, regras) | Contexto longo (`systemInstruction`) | LLMs compreendem prosa com excelência |
| Dados tabulares / CSV | Function Calling (Tools) | LLMs falham em filtrar e agregar linhas numéricas densas |
| Dados pequenos (< 50 linhas) | Contexto longo | Volume insignificante |

---

## Bugs Abertos

| ID | Descrição | Status |
|---|---|---|
| BUG-001 | Filtros de setor e região retornam 0 no Chat | Não resolvido |

Ver detalhes completos em [`docs/bugs-abertos.md`](docs/bugs-abertos.md).

---

## Arquitetura Futura

Direções planejadas mas não implementadas:
- Backend mínimo (proteger API key + centralizar dados)
- MCP server como única fonte de verdade (eliminar duplicação `piespDataService` / `piespService`)
- Nadia Mobile (branch `mobile` — Chat + Voz, mobile-first)

Ver [`docs/arquitetura-futura.md`](docs/arquitetura-futura.md).

---

## Arquitetura Atual

```
Browser
  ├── ChatView → useChat.ts → Gemini (function calling) → piespDataService.ts
  ├── VoiceView → useLiveConnection.ts → Gemini Live API (WebSocket)
  └── Outras views → Gemini (direto, sem function calling)

MCP Server (independente)
  └── piespService.ts (cópia de piespDataService) → Hermes / Claude Desktop
```

---

## Estrutura de Views

| View | Rota | Descrição |
|---|---|---|
| `LandingPage` | `home` | Página inicial |
| `VoiceView` | `voice` | Conversa por voz (Gemini Live API) |
| `ChatView` | `chat` | Chat texto com function calling |
| `PiespDashboardView` | `dashboards` | Dashboard com gráficos Recharts |
| `PerfilMunicipalView` | `municipal` | Mapa 3D + voz para municípios |
| `ExplorarDadosView` | `explorar` | Relatórios analíticos por filtro |
| `PerfilEmpresaView` | `perfil-empresa` | Dossiê de empresa com web search |
| `DataLabView` | `datalab` | Dashboards generativos com voz |
| `UploadView` | `upload` | Publicação de arquivos |

---

## Decisões Arquiteturais

### Function calling: PIESP vs Google Search (não podem ser combinados)
`piespTools` (function calling local) e `searchTools` (Google Search grounding) não podem ser usados na mesma chamada da Gemini API. `useChat.ts` detecta a skill e escolhe qual usar.

### CSV parseado em runtime
Importados como `?raw` e parseados no browser. Sem backend. O cache de `getDashboardData()` em `piespDashboardData.ts` é singleton para evitar reparsing.

### Separação de serviços de dados
- `piespDataService.ts` — filtragem por registro (function calling)
- `piespDashboardData.ts` — agregação completa para gráficos (cached)

### canonicalSetor()
O CSV está em Latin-1, lido pelo Vite como UTF-8. Acentos viram U+FFFD: `"Comércio"` → `"Com\uFFFDrcio"`. `canonicalSetor()` usa padrões ASCII que sobrevivem ao encoding corrompido para identificar setores. `linhaValida()` usa essa função para aceitar linhas de todos os setores.

### MCP Server (`mcp-server/`)
Servidor independente que expõe os dados PIESP via protocolo MCP para agentes externos (Hermes, Claude Desktop). Usa `fs.readFileSync` em vez de `?raw`. Transporte dual: stdio (Claude Desktop) e HTTP+SSE (Hermes).

---

## Features Implementadas

### Branch `claude/add-data-exploration-reports-5yplM`
- **ExplorarDadosView** — filtros → `filtrarParaRelatorio()` → relatório via Gemini
- **PerfilEmpresaView** — busca empresa → dados PIESP + Google Search grounding → dossiê com citações inline
- **EmbeddedChart** — gráficos Recharts embutidos na resposta da IA via blocos ` ```json-chart ` `
- **Sanitização UTF-8 nas citações** — `endIndex` da Grounding API é em bytes UTF-8, JS conta em chars UTF-16; corrigido via `TextEncoder/Decoder`

### Branch `claude/review-ag-ui-I7D3s`
- **DataLabView** — dashboard generativo por linguagem natural (pipeline: extração de filtros → consulta determinística → geração de layout)
- **DynamicDashboard** — renderizador de `json-dashboard`: kpi-cards, chart, bar-list, tabela, texto
- **EmbeddedChart** — tipos novos: `area`, `bar-horizontal`, `composed`
- **MCP Server** — `mcp-server/` com 5 tools e transporte dual

---

## Ferramentas de Desenvolvimento

| Skill | Comando | O que faz |
|---|---|---|
| skill-creator | `/skill-creator` | Cria e melhora skills com loop iterativo |
| find-skills | `/find-skills` | Descobre skills no ecossistema |
| frontend-design | automático | Design intencional e diferenciado |
| vercel-react-best-practices | automático | 69 regras de performance React |
| web-design-guidelines | automático | Auditoria de UI/acessibilidade |

---

## Convenções

- Novas views: prop `onNavigateHome: () => void`, header interno próprio, botão "Voltar"
- Navegação centralizada em `App.tsx` (state machine com `useState<View>`)
- `Header.tsx` recebe callbacks opcionais — adicionar prop ao interface ao incluir nova view
- Tailwind dark-first; paleta: `slate-*` fundos/texto, `rose-*` destaques/ações, `sky-*` links/citações
