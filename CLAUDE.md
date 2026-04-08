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
| `DataLabView` | `datalab` | Dashboards generativos sob demanda com voz *(abril/2026)* |

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

### Abril/2026 — Branch `claude/review-ag-ui-I7D3s`

#### Aba "Data Lab" (`DataLabView.tsx`)

Dashboard analítico gerado inteiramente pela Nadia a partir de linguagem natural — texto ou voz. Cada pergunta produz um layout único, adaptado ao tipo de análise pedida.

**Motivação:** As outras abas têm UI pré-definida pelo desenvolvedor. O Data Lab inverte isso: a Nadia decide o layout depois de entender o que o usuário precisa. Inspirado no conceito de UI Generativa (padrão AG-UI / Shadify), mas implementado sem backend, sem CopilotKit e sem shadcn/ui — apenas Gemini + Recharts + Tailwind, consistente com a stack existente.

**Como funciona (pipeline de 3 passos):**
1. **Extração de filtros** — chamada rápida ao Gemini (thinkingBudget: 0) para transformar linguagem natural em `{ municipio, setor, ano, regiao, termo_busca }`
2. **Consulta determinística** — `filtrarParaRelatorio(filtros)` no CSV local, retorna agregações completas
3. **Geração do dashboard** — chamada ao Gemini (thinkingBudget: 1024) com os dados + skill de design; retorna um bloco ` ```json-dashboard ` que o frontend renderiza

**Modo scratchpad:** cada nova análise substitui a anterior (não acumula). O JSON do dashboard é estado React (`useState`) — descartado a cada nova solicitação. O histórico das últimas 5 queries fica como chips para re-execução rápida.

**Input:** campo de texto + botão de microfone (`useSpeechRecognition`). Ao parar de falar, o envio é automático (mesmo padrão do `ChatView`).

**Arquivos criados:**
- `components/DataLabView.tsx` — view principal
- `components/DynamicDashboard.tsx` — renderizador do `json-dashboard`
- `skills/datalab_design.md` — skill de design (ver seção abaixo)

**Extensão em `piespDataService.ts`:**
`FiltroRelatorio` ganhou os campos `municipio` e `termo_busca`, que antes só existiam em `consultarPiespData`. Isso permite buscas geográficas por linguagem natural no Data Lab.

---

#### `DynamicDashboard.tsx` — Renderizador de Layout Generativo

Interpreta o JSON retornado pela Nadia e renderiza seções dinamicamente. Cada tipo de seção é um sub-componente independente:

| Tipo | Componente | Descrição |
|---|---|---|
| `kpi-cards` | `KpiCards` | Grid de cards com label, valor, detalhe e seta de tendência (↑↓) |
| `chart` | `EmbeddedChart` | Gráfico Recharts (ver tipos abaixo) |
| `bar-list` | `BarList` | Ranking proporcional customizado sem Recharts (mais limpo para listas longas) |
| `tabela` | `Tabela` | Tabela HTML com cabeçalho e linhas alternadas |
| `texto` | `TextoAnalise` | Texto analítico com borda lateral de destaque |

O campo `tendencia: "up" | "down" | "neutral"` nos KPI cards renderiza setas coloridas (emerald para alta, rose para queda).

**Parser:** `parseDashboard(text)` extrai o primeiro bloco ` ```json-dashboard ` da resposta e faz `JSON.parse`. Retorna `null` se inválido — o componente trata o caso de erro graciosamente.

---

#### `EmbeddedChart.tsx` — Tipos de Gráfico Expandidos

Além dos 3 tipos originais (`bar`, `line`, `pie`), foram adicionados:

| Tipo novo | Quando usar |
|---|---|
| `area` | Evolução temporal com volume — 5+ anos de dados; usa gradiente de preenchimento |
| `bar-horizontal` | Rankings com nomes longos (empresas, municípios >12 caracteres) |
| `composed` | Valor absoluto (barra) + tendência (linha) no mesmo gráfico; requer campo `linha` nos dados |

**Guardrail do pie chart (defesa dupla):**
- **No prompt (skill de design):** instrução explícita para nunca gerar mais de 5 fatias
- **No componente (`capPieData`):** função que ordena por valor e agrupa os itens excedentes em "Outros" — executa sempre, independente do que o modelo retornou

A defesa dupla existe porque modelos de linguagem não seguem instruções 100% das vezes. O componente age como rede de segurança determinística silenciosa.

---

#### Skill de Design (`skills/datalab_design.md`)

**Decisão arquitetural:** as regras de composição visual do Data Lab ficam em `skills/datalab_design.md`, importado como `?raw` e interpolado no `buildDashboardPrompt()` — mesmo padrão das outras skills do projeto.

**Por que separar do código TypeScript:**
- Regras de design são conteúdo editável, não lógica de programa
- Permite ajustar critérios (ex: limite do pie, threshold do area) sem tocar em `.tsx`
- Mantém consistência com a convenção `skills/*.md` já estabelecida

**Diferença em relação às outras skills:**
As skills em `skills/` são **lentes analíticas de domínio** (ativadas por palavras-chave via `skillDetector.ts`). A skill de design é **procedimental** — controla formato de saída, não conteúdo analítico. Por isso ela **não passa pelo `skillDetector.ts`** e é injetada diretamente no prompt do Data Lab.

**Conteúdo da skill de design:**
1. Catálogo completo de componentes com sintaxe JSON de exemplo
2. Tabela de seleção de tipo de gráfico (quando usar cada um)
3. Regras de ordenação de seções (kpi-cards → visual principal → contexto → tabela → texto)
4. Regras de não-redundância (proibido mostrar o mesmo dado em dois gráficos)
5. Regras para dados escassos (1 valor → kpi-card; 1-2 anos → sem chart temporal)

**Prompt adaptativo por tipo de análise:**
O `buildDashboardPrompt` detecta 5 tipos de análise e aplica layouts diferentes:
- **Comparação** (2+ entidades) → seções paralelas + `composed` ou `bar-horizontal`
- **Evolução temporal** → `area` obrigatório + kpi-cards com `tendencia`
- **Ranking / Top N** → `bar-list` como peça central + `pie` proporcional
- **Temático / Setorial** → `pie` geográfico + `bar` empresas + evolução temporal do setor
- **Análise geral** → mix completo

**Lição aprendida (confirmação do padrão anterior):** o prompt original usava "EXATAMENTE 4 KPIs + 3 gráficos" como instrução fixa. Substituído por regras adaptativas com mínimo absoluto de `1 kpi-cards + 2 visuais + 1 texto`. O modelo respeita mínimos mas também respeita os máximos implícitos quando as regras de não-redundância são explícitas.

**Nota sobre a criação da skill:** o `datalab_design.md` foi escrito manualmente nesta sessão. O projeto conta com a skill `skill-creator` (instalada via `npx skills add https://github.com/anthropics/skills --skill skill-creator`) que guia a criação iterativa de skills com loop de escrita → teste → avaliação → melhoria. Para revisões futuras da skill de design, recomenda-se usar o `/skill-creator` para estruturar o processo de iteração e avaliação.

---

## Ferramentas de Desenvolvimento

### skill-creator

Instalada em `.agents/skills/skill-creator/` (symlink em `.claude/skills/skill-creator`).

**O que faz:** guia a criação e melhoria iterativa de skills com loop estruturado:
1. Esboço do que a skill deve fazer
2. Criação de prompts de teste
3. Execução e avaliação (quantitativa + qualitativa)
4. Reescrita baseada nos resultados
5. Expansão dos testes em escala

**Como usar:** invoque com `/skill-creator` no Claude Code. Serve tanto para criar skills do zero quanto para melhorar skills existentes.

**Instalação:**
```bash
npx skills add https://github.com/anthropics/skills --skill skill-creator
```

---

## Convenções

- Novas views: prop `onNavigateHome: () => void`, header interno próprio, botão "Voltar"
- Navegação centralizada em `App.tsx` (state machine com `useState<View>`)
- `Header.tsx` recebe callbacks opcionais — adicionar prop ao interface ao incluir nova view
- Tailwind dark-first; paleta: `slate-*` fundos/texto, `rose-*` destaques/ações, `sky-*` links/citações
