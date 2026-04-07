# CLAUDE.md — Histórico de Decisões e Contexto do Projeto

Este arquivo registra decisões arquiteturais, features implementadas e contexto relevante para sessões futuras.

---

## Visão Geral do Projeto

**Nadia-PIESP** é um assistente de IA da Fundação Seade para análise de investimentos no Estado de São Paulo, baseado nos dados da PIESP (Pesquisa de Investimentos no Estado de São Paulo).

- **Stack:** React 19 + TypeScript + Vite, Material-UI + Tailwind CSS
- **IA:** Google Gemini 2.5 Flash (chat e relatórios), Gemini Live API (voz)
- **Dados:** CSVs do PIESP em `knowledge_base/` (importados como `?raw` via Vite)

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
| `ExplorarDadosView` | `explorar` | Relatórios analíticos por filtro *(novo)* |
| `PerfilEmpresaView` | `perfil-empresa` | Dossiê de empresa com web search *(novo)* |

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

## Features Implementadas (Sessão abril/2026)

### Branch: `claude/add-data-exploration-reports-5yplM`

#### 1. Aba "Explorar Dados" (`ExplorarDadosView.tsx`)

Permite ao usuário filtrar dados do PIESP por **setor, região, ano e tipo de investimento** e gerar um relatório analítico com a Nadia.

**Como funciona:**
1. Filtros populados via `getMetadados()` (listas únicas extraídas do CSV)
2. Preview em tempo real do número de projetos encontrados
3. Ao clicar "Gerar Relatório": chama `filtrarParaRelatorio()` localmente → serializa os dados filtrados → envia ao Gemini como contexto → exibe o relatório em `MarkdownRenderer`
4. A chamada ao Gemini é direta (sem function calling), pois os dados já foram filtrados localmente

**Funções novas em `piespDataService.ts`:**
- `filtrarParaRelatorio(filtro)` — filtro estendido (setor, região, ano, tipo) com agregações por setor/município/região
- `getMetadados()` — retorna listas únicas de setores, regiões, anos e tipos

#### 2. Aba "Perfil de Empresa" (`PerfilEmpresaView.tsx`)

Gera um dossiê completo sobre uma empresa combinando dados internos do PIESP com pesquisa na internet.

**Como funciona:**
1. Campo de busca com autocomplete (sugestões das empresas presentes no PIESP)
2. Ao gerar: chama `buscarEmpresaNoPiesp()` localmente → monta prompt com os dados PIESP → chama Gemini com `googleSearch` habilitado
3. O prompt instrui o modelo a buscar ativamente: perfil corporativo, **dados financeiros** (receita, EBITDA, lucro, dívida, market cap, rating), posição de mercado, fatos recentes
4. Citações inline extraídas de `groundingSupports` e injetadas no texto via `injectInlineCitations()`
5. Renderizado pelo `DossieRenderer` (componente local) com suporte a headers, tabelas, listas e badges de citação com tooltip

**Funções novas em `piespDataService.ts`:**
- `getUniqueEmpresas()` — lista ordenada de empresas únicas para autocomplete
- `buscarEmpresaNoPiesp(nome)` — busca empresa por nome (e investidora) sem limite de 10 resultados

**`DossieRenderer`** (componente interno de `PerfilEmpresaView.tsx`):
- Suporta `##`, `###`, `**bold**`, `*italic*`, tabelas markdown e listas
- Renderiza `[N]` como badges clicáveis linkados à fonte, com tooltip no hover
- Fontes exibidas como lista numerada correspondente aos badges

---

## Convenções

- Novas views seguem o padrão: prop `onNavigateHome: () => void`, header interno próprio, botão "Voltar"
- Navegação centralizada em `App.tsx` (state machine simples com `useState<View>`)
- `Header.tsx` recebe callbacks opcionais para cada view — adicionar prop ao interface ao incluir nova view
- Tailwind dark-first; paleta: `slate-*` para fundos/texto, `rose-*` para destaques/ações, `sky-*` para links/citações
