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

## Documentação e Estratégia

Para uma visão completa da evolução do projeto, consulte a pasta `cartografia/`:
- **Ecosistema e Canais:** [`cartografia/ecossistema.md`](cartografia/ecossistema.md) (Abstração Web, Mobile e MCP)
- **Roadmap e Backlog:** [`cartografia/roadmap.md`](cartografia/roadmap.md) (Inclui PEND-001 e BUG-001)
- **Manual de Identidade Visual:** [`materiais/manual-identidade-visual-governo-sp.pdf`](materiais/manual-identidade-visual-governo-sp.pdf)

---

## Canais de Acesso e Branches

O projeto Nadia opera em um modelo multi-branch para diferentes casos de uso:

| Branch | Canal | Foco |
|---|---|---|
| `main` | **Nadia Ecosistema** | Versão Web Full (Desktop). Inclui Dashboards, Explorar, Perfil Municipal, Data Lab e E-mail. |
| `nadia-mobile/0.1` | **Nadia Mobile** | Interface simplificada e otimizada para smartphones. Foca exclusivamente em **Chat** e **Voz**. |

**Branding Oficial:** A versão Mobile utiliza o novo sistema de cores "Deep Ocean" e os brasões oficiais do Governo do Estado de São Paulo e Fundação Seade.

---

## Arquitetura de Resiliência (Voz e Chat)

Implementada para garantir alta disponibilidade mesmo sob falhas da API do Google Gemini.

1. **Retry Automático (withRetry):** O sistema realiza até 2 tentativas automáticas com backoff exponencial (2s, 4s) em caso de erro 503 (servidores sobrecarregados).
2. **Fallback OpenRouter:** Se o Gemini falhar persistentemente no Chat, o sistema commuta silenciosamente para o OpenRouter (usando `google/gemini-2.5-flash-preview`) para evitar interrupção do serviço.
3. **Thinking Budget Otimizado:** O budget de pensamento foi ajustado para `512` tokens para reduzir a latência e o risco de timeouts.

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

**Lição Aprendida (Síndrome do Aluno Desesperado vs Escassez de Dados):** Modelos de linguagem sofrem do viés de subserviência extrema ("helpful bias"). Se instruídos a gerar um dossiê corporativo com gráficos, o LLM gerará gráficos a qualquer custo, mesmo que a base contenha apenas 1 projeto em 1 único ano e em 1 município — resultando num layout estatisticamente ilógico. A solução definitiva não foi presumir "que o modelo sabe", mas forçar barreiras restritivas duras no prompt: proibir gráficos de linha se houver menos de 3 anos, ou gráficos de áreas únicas. As IAs devem ser engessadas em suas obrigações matemáticas estruturais para operarem previsivelmente como API.

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

## MCP Server PIESP — 10/abr/2026

Servidor MCP que expõe os dados da PIESP diretamente no Claude Desktop (e qualquer cliente MCP compatível), sem precisar abrir a Nadia.

### Localização

```
~/Documents/projetos/nadia-piesp/mcp-server/
  src/index.ts        — servidor MCP
  src/piespService.ts — camada de dados (porta do piespDataService.ts)
  dist/               — compilado (usado pelo Claude Desktop)
  knowledge_base/     — symlink → iCloud/Seade/Piesp/Nadia-PIESP/knowledge_base/
```

O symlink garante que qualquer atualização nos CSVs do iCloud é refletida automaticamente.

### Registro no Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "piesp": {
      "command": "node",
      "args": ["/Users/vagnerbessa/Documents/projetos/nadia-piesp/mcp-server/dist/index.js"]
    }
  }
}
```

### 5 tools disponíveis

| Tool | O que faz |
|---|---|
| `consultar_projetos_piesp` | Busca com valor — filtra por ano, município, região, termo |
| `consultar_anuncios_sem_valor` | Anúncios sem cifra |
| `filtrar_para_relatorio` | Agregações completas por setor, região, tipo e ano |
| `get_metadados` | Lista setores, regiões, anos e tipos válidos na base |
| `buscar_empresa` | Dossiê de empresa com totais por ano e município |

### Diferenças em relação ao piespDataService.ts da Nadia

- Leitura dos CSVs via `fs.readFileSync` (em vez de `import ?raw` do Vite)
- Suporte a modo HTTP+SSE além de stdio (ativar com `PORT=3456 node dist/index.js`)
- Filtro por `regiao` com `normalizarRegiao()` idêntico ao da Nadia

### Como usar

Basta fazer perguntas normais no Claude Desktop — as tools são acionadas automaticamente. Para confirmar que o servidor está ativo: **Settings → Developer** — o servidor `piesp` deve aparecer com status verde.

### Manutenção

Se os CSVs forem atualizados, não é preciso fazer nada — o symlink garante acesso imediato.
Se o código do `piespService.ts` for alterado, recompilar e reiniciar o serviço:
```bash
cd ~/Documents/projetos/nadia-piesp/mcp-server && npm run build
launchctl unload ~/Library/LaunchAgents/com.seade.nadia-piesp-mcp.plist
launchctl load ~/Library/LaunchAgents/com.seade.nadia-piesp-mcp.plist
```

### Modo HTTP+SSE (Hermes Agent e outros clientes de rede)

O servidor suporta dois modos de transporte:

| Modo | Como ativar | Usado por |
|---|---|---|
| stdio | padrão (`node dist/index.js`) | Claude Desktop |
| HTTP+SSE | `PORT=3456 node dist/index.js` | Hermes Agent, clientes de rede |

**Para o Hermes**, conectar em: `http://localhost:3456/sse`

Endpoints disponíveis no modo HTTP:
- `http://localhost:3456/sse` — conexão SSE (cliente conecta aqui)
- `http://localhost:3456/messages?sessionId=...` — mensagens MCP
- `http://localhost:3456/health` — health check

### launchd — servidor HTTP sempre ativo (10/abr/2026)

O servidor HTTP (porta 3456) roda como serviço de sistema via `launchd`, iniciando automaticamente com o Mac.

**Arquivo plist:** `~/Library/LaunchAgents/com.seade.nadia-piesp-mcp.plist`

**Logs:**
```bash
tail -f ~/Documents/projetos/nadia-piesp/mcp-server/logs/server.log
tail -f ~/Documents/projetos/nadia-piesp/mcp-server/logs/server.error.log
```

**Comandos:**
```bash
# Status
launchctl list | grep nadia-piesp

# Parar
launchctl unload ~/Library/LaunchAgents/com.seade.nadia-piesp-mcp.plist

# Iniciar
launchctl load ~/Library/LaunchAgents/com.seade.nadia-piesp-mcp.plist
```

**Nota:** O Claude Desktop usa o servidor em modo stdio (entrada direta no config.json), independente do launchd. O launchd serve exclusivamente para o modo HTTP (Hermes e outros clientes de rede).

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
- **Skills de design:** ao receber pedidos de UI/design, **SEMPRE** consultar `skills/datalab_design.md` antes de codificar. A pasta `skills/` fica na raiz do projeto.

---

## Fallback OpenRouter em todas as views — 10/abr/2026

### Problema

O fallback para OpenRouter implementado em 09/abr estava conectado apenas no `useChat.ts`. As demais views (`ExplorarDadosView`, `PerfilEmpresaView`, `DataLabView`) chamavam `ai.models.generateContent()` diretamente e exibiam mensagem de erro ao receber 503 — sem tentar o fallback.

### Solução: `services/geminiService.ts`

Novo serviço centralizado com a função `generateWithFallback()`:

```ts
generateWithFallback({ prompt, systemInstruction?, thinkingBudget?, tools? })
  → { text, groundingChunks?, groundingSupports? }
```

**Fluxo interno:**
1. Tenta Gemini direto (`gemini-2.5-flash`)
2. Se Gemini falhar (quer erro) e `OPENROUTER_API_KEY` configurada → tenta OpenRouter (`openai/gpt-4o-mini`)
3. Se ambos falharem → relança o erro (tratado por cada view)

**Fallback Model**: `openai/gpt-4o-mini` (updated for better stability when Gemini upstream is rate-limited). O fallback dispara em **qualquer** falha do Gemini (não apenas 503), garantindo maior cobertura.

**Views migradas:**
- `ExplorarDadosView` — substituiu `ai.models.generateContent()` por `generateWithFallback()`
- `DataLabView` — as duas chamadas (extração de filtros + geração de dashboard) foram substituídas
- `PerfilEmpresaView` — substituída; `tools: [{ googleSearch: {} }]` é passado normalmente; no fallback OpenRouter o dossiê é gerado sem citações inline (grounding não disponível fora do Gemini)

**Nota sobre `PerfilEmpresaView` no fallback:** `groundingChunks` e `groundingSupports` são retornados pelo `generateWithFallback` quando disponíveis (Gemini). No fallback OpenRouter, ambos são `undefined` — o dossiê aparece sem badges de citação, mas o texto analítico é preservado.

### Lazy loading de views — 10/abr/2026

`App.tsx` foi refatorado para usar `React.lazy()` + `Suspense` em todas as views. Cada view agora é um chunk JS separado carregado sob demanda.

**Impacto no bundle:**
- Antes: 5,48 MB em um único arquivo JS
- Depois: ~350 KB gzip no carregamento inicial; `piespDataService` (CSVs, 4 MB) só é baixado quando o usuário acessa uma view analítica

**Fallback visual:** spinner `rose-500` animado enquanto o chunk carrega (`ViewLoader` em `App.tsx`).

### Merge com branch claude/review-ag-ui-I7D3s — 14/abr/2026

**Problema pós-merge:** o remote havia adotado um script `scripts/convert-csvs.js` que converte os CSVs para UTF-8 e gera arquivos `*.utf8.csv`, com os imports apontando para esses arquivos. Como mantivemos o `package.json` local (sem o script de conversão), os arquivos `.utf8.csv` não existiam e o Vite quebrava na inicialização.

**Solução:** revertido os imports em `piespDataService.ts` para os arquivos originais:
```ts
import PIESP_DATA from '../knowledge_base/piesp_confirmados_com_valor.csv?raw';
import PIESP_SEM_VALOR_DATA from '../knowledge_base/piesp_confirmados_sem_valor.csv?raw';
```

**Regra:** não usar o script `convert-csvs.js` nem arquivos `.utf8.csv` neste projeto. Os CSVs originais funcionam corretamente com o `piespDataService.ts` atual, que já trata o encoding internamente via `canonicalSetor()` e normalização de strings.

---

## Resiliência de Infraestrutura — Lições de 08/abr/2026

### Problema: Erro 503 generalizado na API REST do Gemini

**Sintoma:** Todas as abas que usam `ai.models.generateContent()` (Chat, Data Lab, Explorar, Empresas) retornaram erro 503 ("high demand / UNAVAILABLE") simultaneamente, enquanto a aba de Voz (WebSocket) continuou funcionando normalmente.

**Causa raiz:** A API REST do modelo `gemini-2.5-flash` entrou em alta demanda/sobrecarga nos servidores do Google. A Live API (WebSocket) do modelo `gemini-2.5-flash-native-audio-preview` roda em infraestrutura separada e não foi afetada.

| Canal | Modelo | Protocolo | Infraestrutura |
|---|---|---|---|
| Voz (VoiceView) | `gemini-2.5-flash-native-audio-preview` | WebSocket (Live API) | Servidores dedicados a áudio |
| Chat / Data Lab / Explorar / Empresas | `gemini-2.5-flash` | REST (generateContent) | Pool compartilhado REST |

**Tentativa fracassada — Downgrade para `gemini-2.0-flash`:**
Ao tentar contornar o 503 trocando para `gemini-2.0-flash`, o Google retornou erro 404: *"This model is no longer available to new users."* O modelo 2.0 foi descontinuado sem aviso prévio neste período. **Lição:** nunca trocar para um modelo antigo sem antes verificar sua disponibilidade na documentação oficial do Google AI.

**Solução aplicada:**
1. Revertemos para `gemini-2.5-flash` (o único modelo funcional disponível)
2. Padronizamos mensagens de erro amigáveis em **todas as 4 abas** para nunca expor JSON cru ao usuário
3. Aguardamos a normalização dos servidores do Google (a instabilidade é temporária)

### Padrão de Tratamento de Erros (obrigatório em todas as views)

Toda chamada à API do Gemini via `generateContent()` deve ter um `catch` que **nunca** exponha a mensagem técnica ao usuário. A mensagem padrão é:

```
Nadia (servidores do Google Gemini) está enfrentando uma instabilidade/alta demanda momentânea. Por favor, aguarde alguns segundos e tente novamente.
```

**Arquivos onde o padrão foi aplicado:**
- `hooks/useChat.ts` — aba Chat
- `components/DataLabView.tsx` — aba Data Lab
- `components/ExplorarDadosView.tsx` — aba Explorar
- `components/PerfilEmpresaView.tsx` — aba Empresas

**Regra:** ao criar novas views com chamadas à API, copiar este padrão de tratamento de errro. Nunca usar `e.message` diretamente na UI.

### Modelo ativo e thinkingBudget

- **Modelo REST:** `gemini-2.5-flash` (todas as views de texto)
- **Modelo WebSocket:** `gemini-2.5-flash-native-audio-preview-12-2025` (VoiceView)
- **thinkingBudget:** Definido como `0` em todas as views para reduzir consumo de recursos e mitigar erros 503. O Chat no modo "Completo" usa `512` (reduzido de 2048 em 09/abr/2026 para mitigar quota e 503).

---

## Filtro de Ano no Dashboard — 09/abr/2026

### Funcionalidade

Chips de filtro por ano adicionados ao topo do painel de KPIs em `PiespDashboardView.tsx`. Ao selecionar um ano:
- KPIs (volume, projetos, empresas, municípios), setores, municípios, empresas, tipo e concentração filtram para aquele ano
- O gráfico "Volume por Ano" é substituído por "Volume por Mês — AAAA", mostrando a distribuição mensal do ano selecionado
- "Todos" restaura a visão histórica completa

O gráfico histórico de anos sempre usa `allData.porAno` (dados completos), nunca é afetado pelo filtro.

### Arquitetura

**`services/piespDashboardData.ts`:**
- `PiespRecord` ganhou o campo `mes` (col[2] do CSV)
- `DashboardData` ganhou `porMes?: AggItem[]`
- `MES_NAMES` mapeia número de mês para nome abreviado em pt-BR ("1" → "Jan" etc.)
- `_records` — cache de records brutos separado do cache agregado
- `getRecords()` — singleton dos records brutos (evita reparsing)
- `getAvailableYears()` — lista ordenada de anos únicos da base
- `agregarRecords(records)` — função interna que agrega qualquer subconjunto de records (refatoração do `getDashboardData`)
- `getDashboardDataByYear(ano)` — filtra records pelo ano e agrega, com cache por chave (`_cacheByYear`)
- `getDashboardData()` simplificado para delegar a `agregarRecords(getRecords())`

**`components/PiespDashboardView.tsx`:**
- `useState<string | null>` para o ano selecionado (null = "Todos")
- `data` = `getDashboardDataByYear(selectedYear)` ou `getDashboardData()` conforme seleção
- `allData` = dados completos, sempre passado para o gráfico de evolução histórica
- Chips de filtro com estilo ativo (`rose-500` para "Todos", `cyan-400` para anos)

---

## Alterações de UI — 08/abr/2026

### Dashboard (`PiespDashboardView`)
- Eixo Y do gráfico "Volume por Ano": adicionado `width={75}` ao `<YAxis>` para evitar word-wrap nos valores monetários formatados em pt-BR (ex: "R$ 135,0 bi" quebrava em 2 linhas)
- Gráfico de "Volume por Ano" convertido de `BarChart` para `AreaChart` (conforme regra da skill de design: evolução temporal com 5+ anos → area)

### Data Lab (`DataLabView`)
- Ícone do microfone substituído pelo componente `SoundWaveIcon` (mesmo ícone animado do Chat), garantindo identidade visual unificada

### Empresas (`PerfilEmpresaView`)
- Adicionadas regras anti-gráficos-mono-dados no prompt do dossiê: proibido gerar gráficos quando há apenas 1 município, 1 setor ou menos de 3 anos de dados.

---

## Refatoração: Sistema de Citações e Fontes — 08/abr/2026

Implementamos uma reconstrução completa do processamento de Grounding (pesquisa web) na aba de Empresas para resolver inconsistências críticas de UX e integridade de dados.

### Problemas Identificados
1.  **Índices Órfãos e Saltos Numéricos**: Frequentemente, as citações no texto começavam no número `[2]` ou pulavam índices (ex: `[1], [3]`), pois a API do Gemini incluía "chunks" de busca que não possuíam links reais ou eram inválidos, mas ainda ocupavam uma posição na contagem original.
2.  **Links de "Lixo" (Search Widgets)**: A API do GoogleSearch ocasionalmente retornava URIs que não eram artigos, mas sim widgets de busca (clima, horários do Google, sugestões de query), poluindo a seção de fontes com links inúteis.
3.  **Poluição Visual**: A lista de fontes era exibida em um bloco estático no final da página, disputando atenção com o texto principal do dossiê.
4.  **Falhas Silenciosas (White Screen)**: Em momentos de timeout do Gemini, o sistema injetava um texto de "fallback" genérico ("Não foi possível...") que mascarava a falha de rede e não renderizava a UI de fontes corretamente, deixando o usuário sem feedback visual de erro.

### Soluções Implementadas
-   **Filtro Genômico de Chunks**: O parser agora ignora qualquer link que aponte para `google.com/search`, links sem URI ou ocos. Isso garante que *apenas* fontes de informação reais cheguem ao usuário.
-   **Mapa de Re-indexação Sequencial (`indexMap`)**: Criamos uma lógica que mapeia os índices originais da API para uma nova sequência estritamente consecutiva (1, 2, 3...). Assim, mesmo que os chunks nº 1 e 2 sejam descartados por serem lixo, o chunk original nº 3 passará a ser exibido como `[1]` no texto e na lista.
-   **Módulo Accordion (Retrátil)**: Substituímos o rodapé fixo por um componente interativo estilo gaveta com ícones de identidade visual (Book/Chevron) e contadores de fontes verificadas.
-   **Transparência de Erro**: Removemos as strings de fallback silenciosas. Caso o Gemini retorne um dossiê vazio (timeout), o sistema agora dispara um erro explícito que aciona o banner vermelho de instabilidade, informando corretamente o estado da conexão.
-   **Tratamento UTF-8 Robusto**: O injetor de citações agora trabalha com arrays de bytes (`Uint8Array`) para garantir que os marcadores `[N]` sejam inseridos em posições exatas sem corromper caracteres acentuados típicos da língua portuguesa.

### Bug Fix: Animação do Accordion — 08/abr/2026

**Problema:** A animação do accordion de fontes usava a técnica CSS Grid (`grid-rows-[0fr]` → `grid-rows-[1fr]` via classes arbitrárias do Tailwind). Com o Tailwind carregado via CDN Play (`cdn.tailwindcss.com`), a transição de `grid-template-rows` não é processada de forma confiável — o browser colapsava ou expandia o painel sem animação, ou não respondia ao estado.

**Solução:** Substituído pelas classes Tailwind por `style` inline com `maxHeight` + `overflow: hidden`:
```tsx
style={{
  maxHeight: isSourcesOpen ? '2000px' : '0',
  overflow: 'hidden',
  transition: 'max-height 0.35s ease-in-out, opacity 0.3s ease-in-out',
  opacity: isSourcesOpen ? 1 : 0,
}}
```

**Regra:** Ao usar animações de colapso/expansão **neste projeto (Tailwind via CDN)**, sempre preferir `max-height` via inline style. Nunca usar `grid-rows-[0fr]`/`grid-rows-[1fr]` — essas classes arbitrárias dependem do JIT do Tailwind compilado, não do CDN Play.

---

## Melhorias de UX — Aba Empresas — 08/abr/2026

### Layout duas colunas com painel de fontes lateral

O layout da aba Empresas foi reestruturado: o dossiê ocupa a coluna principal (esquerda, `flex-1`) e o painel de "Referências e Fontes" fica em uma coluna lateral direita (`w-48`, `sticky top-4`). O painel usa `order` CSS para controle de posicionamento sem reorganizar o DOM.

O painel sticky tem scroll interno próprio (`max-h: 70vh, overflow-y: auto`) para não ultrapassar a viewport.

### Remoção do preâmbulo gerado pela IA

O Gemini frequentemente gera texto introdutório antes do primeiro `## ` do dossiê ("Estou elaborando...", "Aguarda um momento...", etc.). Esse texto é descartado via:
```ts
const primeiroH2 = textoCitado.indexOf('\n## ');
const textoLimpo = primeiroH2 > 0 ? textoCitado.slice(primeiroH2 + 1) : textoCitado;
```

### Citações dentro de itálico/negrito

O `parseInline` era não-recursivo: blocos `*itálico*` ou `**negrito**` que contivessem `[N]` engoliam a citação sem processá-la. Corrigido tornando os handlers recursivos:
```tsx
if (part.startsWith('*') && part.endsWith('*')) {
  return <em>{parseInline(part.slice(1, -1), keyPrefix)}</em>;
}
```

### Limite de citações por ponto de injeção

O grounding da API pode injetar 4+ citações no mesmo ponto (`[11][12][13][14]`). Limitado a 2 por ponto com `.slice(0, 2)` no `injectInlineCitations`.

### Remoção da aba "Publicar"

O botão "Publicar" foi removido do `Header.tsx` junto com o import de `CloudArrowUpIcon` e a prop `onNavigateToUpload`.

---

## Sistema de Agentes no Chat — 09/abr/2026

### Contexto

O usuário queria que a Nadia respondesse sob a ótica de "lentes analíticas" especializadas (skills) de forma explícita e controlada, sem depender da detecção automática por palavras-chave.

### Arquitetura Implementada

**Seleção manual de skill ("Agente")** antes ou durante a conversa no `ChatView`.

**Fluxo:**
1. Usuário abre o Chat → input centralizado (estado inicial, sem mensagens)
2. Usuário clica em "Agentes" → dropdown abre com 8 opções + "Geral"
3. Ao selecionar um agente, um badge aparece dentro da caixa de input
4. Cada mensagem enviada com agente ativo injeta a skill no `systemInstruction`
5. O agente pode ser trocado ou removido a qualquer momento — sem reiniciar o histórico

**Arquivos alterados:**
- `services/skillDetector.ts` — adicionadas `getSkillByName()` e `buildSystemInstructionWithSkillByName()` para injeção direta por nome (sem detecção por keywords)
- `hooks/useChat.ts` — aceita `{ selectedSkillName }` na inicialização; se fornecido, bypassa a auto-detecção
- `components/ChatView.tsx` — reescrito com novo layout e UI de seleção de agentes

### Agentes disponíveis (8)

| Nome interno | Label |
|---|---|
| `emprego_empregabilidade` | Emprego e Empregabilidade |
| `qualificacao_profissional` | Qualificação Profissional |
| `logistica_infraestrutura` | Logística e Infraestrutura |
| `inovacao_tecnologia` | Inovação e Tecnologia |
| `desenvolvimento_regional` | Desenvolvimento Regional |
| `cadeias_produtivas` | Cadeias Produtivas |
| `transicao_energetica` | Transição Energética |
| `comercio_exterior` | Comércio Exterior |

A `inteligencia_empresarial` foi excluída da lista de agentes manuais — ela usa Google Search (incompatível com piespTools) e é mais adequada para a aba Empresas.

### Layout do ChatView — dois estados (padrão Gemini)

| Estado | Condição | Layout |
|---|---|---|
| Inicial | `chatStarted === false` | Input centralizado em `pt-[12%]` da área de conteúdo |
| Chat | `chatStarted === true` | Mensagens (flex-grow) + input no rodapé (`pb-8`) |

`chatStarted` vira `true` no primeiro `sendMessage`.

### UI do seletor de Agentes

- Botão "Agentes" com chevron na barra inferior do input (mesmo padrão do "Ferramentas" no Gemini)
- Dropdown com `position: absolute`, abre **para baixo** no estado inicial, **para cima** (`bottom-full`) no estado de chat (sem espaço abaixo)
- "Geral" fixo no topo do dropdown; 8 agentes na lista abaixo com `max-h: 260px` e `overflow-y-auto`
- Ícones SVG inline por agente (sem emojis — produto analítico)
- Badge no input quando agente ativo: `rose-500/10` com botão `×` para remover

### Confirmação de skill no console

Ao enviar cada mensagem, o console exibe:
- `🎯 [Agente manual] Skill "nome" injetada. System instruction: N chars.`
- `🎯 [Agente auto] Skill "Label" detectada por keywords.`
- `ℹ️ [Sem agente] Nenhuma skill ativa.`

---

## Correção: Filtro por Região Administrativa no Chat — 09/abr/2026

### Problema

A tool `consultar_projetos_piesp` (function calling do Chat) só aceitava `municipio`, `ano` e `termo_busca`. Quando o usuário perguntava sobre "RA Santos" ou "Região Administrativa de Santos", o modelo não conseguia filtrar por região em uma única chamada. Como workaround, ele fazia múltiplas chamadas sequenciais (uma por município), resultando em:

1. Respostas "graduais" — modelo narrava cada passo ("Já consultei Guarujá, agora vou verificar Santos...")
2. Limite de `maxIterations = 3` cortava a resposta incompleta
3. "RA Santos" e "Região Administrativa de Santos" não eram reconhecidos como equivalentes

### Solução

**`services/piespDataService.ts`:**
- Adicionado campo `regiao?: string` à interface `FiltroPiesp`
- Adicionada função `normalizarRegiao()` que converte qualquer variante para forma canônica:
  - "Região Administrativa de Santos" → "ra santos"
  - "RA de Santos" → "ra santos"
  - "RA Santos" → "ra santos"
- Matching bidirecional: `regiaoNorm.includes(filtroNorm) || filtroNorm.includes(regiaoNorm)`
- Campo `regiao` retornado nos resultados (coluna 8 do CSV)

**`hooks/useChat.ts`:**
- Adicionado parâmetro `regiao` na declaração da tool `consultar_projetos_piesp`
- Descrição instrui explicitamente: *"NÃO tente município por município"* quando o usuário mencionar região
- `executarFerramenta` repassa `args.regiao` para `consultarPiespData`

**Resultado:** Uma única tool call com `regiao: "RA Santos"` retorna todos os projetos da região, eliminando as chamadas sequenciais e a resposta fragmentada.

---

## Resiliência de API — Chat — 09/abr/2026

### Problema

O error handler do `useChat.ts` tinha dois problemas críticos:

1. **Ternário inútil:** ambos os branches do `isSeverError ? ... : ...` retornavam a mesma string — qualquer erro (503, bug de código, 429, chave inválida) exibia a mesma mensagem genérica de "instabilidade"
2. **Sem retry:** um 503 momentâneo exigia que o usuário reenviasse a mensagem manualmente

### Soluções

**Error handler diferenciado** — cada categoria de erro tem mensagem própria:

| Erro | Mensagem |
|---|---|
| 429 / quota / rate limit | "Limite de requisições atingido (quota da API)" |
| 503 / unavailable / overloaded | "Servidores sobrecarregados — aguarde e tente novamente" |
| 500 | "Erro interno nos servidores do Google Gemini" |
| 401 / 403 / api_key | "Problema com a chave de API" |
| Outros | Exibe `e.message` real na UI + log detalhado no console |

**Retry automático com backoff** — função `withRetry()`:
- Tenta até 2x adicionais em caso de 503/UNAVAILABLE
- Delays: 2s na primeira re-tentativa, 4s na segunda
- Aplicada nas duas chamadas `generateContent` do loop de function calling
- Log no console: `⏳ Gemini 503 — tentativa 1/2. Aguardando 2000ms...`

**`thinkingBudget` reduzido:** modo "Completo" passou de `2048` → `512` tokens para reduzir pressão na quota e mitigar 503.

### Fallback de provedor: OpenRouter — 09/abr/2026

**Problema:** Quando o Gemini retorna 503 persistente (mesmo após os 2 retries do `withRetry`), o usuário via uma mensagem de erro e precisava tentar manualmente.

**Solução implementada:** Fallback automático e silencioso para o OpenRouter quando o Gemini falha com 503.

**Fluxo de resiliência em 3 camadas:**
1. Gemini direto (tentativa normal)
2. `withRetry` — 2 re-tentativas automáticas com backoff (2s / 4s)
3. OpenRouter — mesma query, mesma ferramenta, infraestrutura diferente

**Modelo de fallback:** `google/gemini-2.5-flash-preview` via OpenRouter — mesmo modelo do Gemini direto, roteado pela infraestrutura do OpenRouter (que tem SLA próprio e costuma estar disponível quando a API direta do Google está sobrecarregada).

**Arquivos criados/alterados:**
- `services/openrouterService.ts` — serviço completo com:
  - `geminiContentsToOAI()` — converte histórico Gemini → mensagens OpenAI
  - `geminiToolsToOAI()` — converte `functionDeclarations` → `tools[].function`
  - `convertGeminiParams()` — converte tipos (`Type.OBJECT` → `"object"`)
  - `callOpenRouter()` — POST para `https://openrouter.ai/api/v1/chat/completions` com loop de function calling no formato OpenAI
- `config.ts` — adicionado `OPENROUTER_API_KEY` (preencher com chave de openrouter.ai/keys)
- `hooks/useChat.ts` — variáveis `contents`, `systemInstructionWithSkill` e `ferramentasAtivas` hoistadas para fora do `try` (necessário para acessá-las no `catch`); fallback ativado no `catch` quando `is503 && OPENROUTER_API_KEY`

**Comportamento para o usuário:**
- Se OpenRouter responder com sucesso: resposta aparece normalmente, sem nenhum erro visível
- Se OpenRouter também falhar: exibe mensagem de erro padrão de 503
- Logs no console: `🔀 Gemini 503 persistente — ativando fallback OpenRouter...`

**Ativação:** preencher `OPENROUTER_API_KEY` em `config.ts`. Se vazio, o fallback é ignorado e o comportamento anterior (mensagem de erro) é mantido.

---

## Hermes + Telegram + MCP compatível — 10/abr/2026

### Problema 1: Hermes não conseguia usar o MCP HTTP+SSE legado

O servidor MCP já existente para PIESP rodava em:

- `GET /sse`
- `POST /messages?sessionId=...`
- `GET /health`

Esse desenho funciona para clientes legados baseados em `SSEServerTransport`, mas o Hermes v0.8.0, na configuração `mcp_servers.<name>.url`, usa **MCP Streamable HTTP**. Na prática:

- o Hermes conectava
- negociava protocolo
- e encerrava a sessão com `Session terminated`

Diagnóstico:

- `hermes mcp test piesp` falhava contra `http://localhost:3456/sse`
- o processo ativo na porta `3456` era outro projeto em `/Users/vagnerbessa/Documents/projetos/nadia-piesp/mcp-server/dist/index.js`
- esse processo expunha apenas `SSEServerTransport`, sem endpoint `/mcp`

### Solução 1: criar servidor MCP Streamable HTTP compatível

Foi criado um servidor novo e separado dentro deste repositório:

- `scripts/piesp-mcp-server.mjs`

Ele:

- usa `@modelcontextprotocol/sdk`
- registra 5 tools:
  - `consultar_projetos_piesp`
  - `consultar_anuncios_sem_valor`
  - `filtrar_para_relatorio`
  - `get_metadados`
  - `buscar_empresa`
- lê diretamente os CSVs da pasta `knowledge_base/`
- expõe:
  - `GET /health`
  - `POST/GET /mcp` via `StreamableHTTPServerTransport`

Escolha importante de implementação:

- modo **stateless** (`sessionIdGenerator: undefined`)
- `enableJsonResponse: true`

Isso simplifica o uso pelo Hermes e evita depender do fluxo legado `/sse` + `/messages`.

### Problema 2: conflito de porta com o MCP antigo

A porta `3456` já estava ocupada por um servidor antigo em outro diretório do usuário.

Se o novo servidor tentasse subir na mesma porta:

- havia conflito operacional
- e ficava ambíguo qual servidor o Hermes estava usando

### Solução 2: isolar o servidor compatível na porta 3457

O servidor novo foi publicado como serviço `launchd` do usuário em:

- `/Users/vagnerbessa/Library/LaunchAgents/ai.piesp.mcp.plist`

Configuração final:

- host: `127.0.0.1`
- porta: `3457`
- health: `http://127.0.0.1:3457/health`
- mcp: `http://127.0.0.1:3457/mcp`

Logs:

- `~/.hermes/logs/piesp-mcp.log`
- `~/.hermes/logs/piesp-mcp.error.log`

Script adicionado em `package.json`:

```json
"mcp": "node scripts/piesp-mcp-server.mjs"
```

### Problema 3: Hermes no Telegram falhava por crédito insuficiente no OpenRouter

No bot do Telegram, o erro observado foi:

- `HTTP 402`
- pedido grande demais para o saldo disponível do OpenRouter

Ou seja: o problema não era Telegram nem MCP; era o provedor principal do Hermes.

### Solução 3: migrar o Hermes para OpenAI Codex

O ambiente Hermes já estava autenticado em `OpenAI Codex`, então o provedor principal foi alterado para:

- provider: `openai-codex`
- model: `gpt-5.4-mini`
- api_mode: `codex_responses`
- base_url: `https://chatgpt.com/backend-api/codex`

Com isso:

- o bot deixou de depender do saldo do OpenRouter
- o MCP PIESP continuou ativo normalmente
- o gateway do Telegram voltou a responder sem o erro de crédito

### Configuração final usada pelo Hermes

Em `~/.hermes/config.yaml`:

```yaml
model:
  base_url: https://chatgpt.com/backend-api/codex
  api_mode: codex_responses
  provider: openai-codex
  default: gpt-5.4-mini

mcp_servers:
  piesp:
    url: http://127.0.0.1:3457/mcp
    enabled: true
    connect_timeout: 60
    timeout: 120
```

Validação final:

- `hermes mcp test piesp` → conectado com 5 tools descobertas
- `hermes gateway restart` → gateway voltou online
- bot do Telegram funcionando via `@Nadia_Seade_bot`

### Observação operacional

O comando `/start` não é um slash command nativo do Hermes. No Telegram, o Hermes responde com:

- `Unknown command /start`

Então o uso normal do bot deve ser:

- mandar uma mensagem comum, por exemplo `Olá Nadia`
- usar `/sethome` apenas se quiser marcar o chat como home channel

---

## Trade-offs e Soluções Técnicas Adotadas

*Registro histórico de escolhas arquiteturais e raciocínios de engenharia.*

### Por que Function Calling em vez de contexto longo para dados tabulares
**Tentativa:** carregar o CSV inteiro na `systemInstruction` do Gemini.
**O que aconteceu:** com 5.000 linhas de dados tabulares densos, o modelo alucinava. Perguntado sobre "principais investimentos em 2026", inventava valores. LLMs não agem como bancos de dados SQL — a atenção se dilui com volume tabular, o modelo interpola em vez de filtrar.
**Decisão:** Function Calling explícito (via `piespDataService.ts`). O modelo chama a ferramenta, o JavaScript filtra deterministicamente, devolve JSON compacto. O modelo só interpreta e apresenta a síntese.

### Por que `piespTools` e `searchTools` não podem ser combinados
Não é uma preferência, é uma limitação técnica profunda da API Gemini. Function declarations (Tools) e a propriedade de `Google Search Grounding` são mutuamente exclusivas na mesma chamada do pipeline `generateContent`. Essa limitação afeta views compostas (como a aba `Empresas`).

### Por que a skill de design do DataLab não passa pelo `skillDetector`
As skills na pasta `skills/` são **lentes analíticas de domínio** — ativadas pelo NLP (ex: quando falamos de inteligência empresarial, ativa-se).
No Oposto, a skill hierárquica `datalab_design.md` é **procedimental** — controla puramente o formato de saída mecânico (JSON estruturado com blocos de gráficos UI), independentemente da temática (Assunto XYZ). Portanto, é aplicada estaticamente via Prompt Injection.

### Por que prompts de gráficos usam ordens estritas em vez de sugestões
**Tentativa:** Usar o famigerado 'Helpful AI bias' com *"se julgar visualmente útil, insira um gráfico"*.
**O que aconteceu:** O modelo otimiza para mínimo esforço tokenizado. Ele sempre gerava apenas 1 gráfico de barras genérico e ignorava a visualização dos dados inteiros.
**Decisão:** Adotamos Ordens Estritas ditatoriais com limites mínimos absolutos ("gere no MÍNIMO 2 gráficos de frentes diferentes").

### Defesa Dupla de Renderização (Prompt + Frontend Guardrails)
O prompt orienta a modelo: "nunca gere mais de 5 fatias de pizza". No entanto, LLMs podem quebrar diretrizes devido a anomalias de temperatura. 
Por causa disso, o nosso `capPieData` na UI engole e reagrupa magicamente qualquer variável que passar de 5 em uma sub-fatia "Outros", sem que o usuário sinta. O Prompt define a regra social, mas é o frontend que blinda matematicamente o sistema contra LLMs voláteis.

### Mudança para DuckDB-WASM e Abandono do CSV (24/04/2026)
- **Problema:** O parser CSV local estava sofrendo com delimitações falhas (ponto e vírgula contidos nos campos de descrição textual), causando corrupção de dados e inconsistências nas colunas. Isso afetava a integridade da UI do Dashboard e da IA (geração de respostas alucinadas com descrições onde deviam haver CNAEs).
- **Solução Implementada:** Todo o backend web da PIESP foi refatorado para utilizar `DuckDB-WASM` carregando um arquivo `piesp.parquet` diretamente na memória do navegador. 
- **Benefícios:** Elimina 100% dos erros de parsing. Utiliza tipagem de dados SQL garantindo queries eficientes `(SELECT * FROM piesp WHERE...)`. O motor é executado de forma assíncrona, não travando a UI.
- **Reflexo no Código:** `piespDataService.ts` centraliza a chamada SQL assíncrona com `db.all()`. O uso do `PIESP_DATA.split('\n')` foi descontinuado. Os arrays retornados `projetos`, `setores`, `municipios` etc. foram normalizados para um objeto `ResumoRelatorio` coerente em toda a aplicação (`DataLabView`, `ExplorarDadosView`, `PiespDashboardView`, `VoiceView` e `PerfilEmpresaView`).


## Migração DuckDB-WASM e Estabilização da IA — 24/abr/2026

### Migração do Engine (CSV para Parquet + DuckDB-WASM)
O sistema foi refatorado para utilizar o DuckDB-WASM rodando diretamente no browser, consumindo o arquivo `piesp.parquet`. Isso eliminou travamentos do Event Loop que ocorriam durante o parseamento síncrono do CSV antigo e resolveu erros de parsing causados por ponto e vírgula na base.

### Estabilização de Buscas e Inteligência Artificial
**1. Tratamento de Acentos no DuckDB:**
A função `LOWER()` do DuckDB é sensível a acentos, o que impedia a IA de encontrar termos como "saúde" se a query não fosse idêntica ao banco. Foi implementada uma rotina em `piespDataService.ts` que normaliza o `termo_busca`, substituindo vogais acentuadas pelo caractere coringa `_` (SQL wildcard). Assim, `%sa_de%` captura tanto "saude" quanto "saúde".

**2. Restrições Estritas de Setor no Prompt:**
O LLM foi proibido de classificar sub-setores não mapeados (como "Saúde", "Tecnologia", etc.) dentro do argumento `setor`. O prompt do `useChat.ts` agora instrui a IA a direcionar todas as especificidades do negócio para o argumento `termo_busca`, limitando o `setor` exclusivamente às 5 categorias macro-oficiais da Seade.

**3. Ampliação do Índice de Busca:**
A query SQL no DuckDB agora utiliza `CONCAT_WS` integrando os campos de CNAE (`cnae_inv_2_desc`, `cnae_inv_descricao`, `cnae_empresa_descricao`) ao escopo de pesquisa de texto livre (`termo_busca`), aumentando radicalmente a precisão e taxa de acerto de buscas por nichos de mercado.

**4. Dossiê de Empresa ("Dados não disponíveis"):**
Para empresas oriundas da base "sem valor divulgado", a interface e o prompt em `PerfilEmpresaView.tsx` foram corrigidos. Em vez de exibir falsos investimentos de "R$ 0 milhões", o sistema agora identifica o agrupamento de valor zerado e informa visualmente (e textualmente para a IA) como "Não divulgado" / "Dados não disponíveis".

---

## Animação Palavra-a-Palavra e React 18 Batching — 29/abr/2026

### Sintoma
Na branch `feature/v0.3-duckdb-streaming`, o texto de resposta da Nadia aparecia **todo de uma vez** (sem animação palavra-a-palavra), especialmente após consultas que acionavam tool calls (DuckDB). Na branch `nadia-mobile/0.2.1`, a mesma animação funcionava corretamente.

### Causa Raiz: React 18 Automatic Batching
O React 18 introduziu o **automatic batching**: todas as chamadas `setState` dentro do mesmo contexto assíncrono são agrupadas num único commit. O React aplica as atualizações em ordem — e a última vence.

**Por que o mobile aparentemente funcionava:** respostas sem tool call chegam em múltiplos chunks via `for await`. Entre cada chunk há uma pausa real de rede, o React faz flush, o `useEffect` do drain dispara, e a fila de palavras é preenchida incrementalmente. **O bug existe na branch `nadia-mobile/0.2.1` também** — o código faz `setStreamingComplete(true)` seguido de `setStreamingText(null)` no mesmo batch. Ele só não se manifestava porque as consultas típicas do mobile (sem DuckDB/tool calls) sempre retornavam múltiplos chunks. Qualquer resposta que chegue em chunk único quebrará a animação no mobile também.

**Por que quebrava após tool calls:** o Gemini entrega a resposta final em **um único chunk** (comum após processar uma query DuckDB). Toda a sequência abaixo acontecia no mesmo tick assíncrono:

```
setStreamingText(prev => prev + "texto inteiro")  ← acumula
setStreamingComplete(true)                         ← sinaliza fim
setStreamingText(null)                             ← colapsava tudo
setIsLoading(false)
```

React aplicava em ordem: o texto acumulava, depois `null` sobrescrevia. O `useEffect` do drain disparava com `streamingText = null` — a fila nunca era preenchida.

### Solução (commit `4a77cdc`)

**1. `setStreamingText(null)` removido do caminho de sucesso** (`try`/`finally`)
`streamingText` mantém o valor acumulado quando `setStreamingComplete(true)` é chamado. O drain lê o texto, preenche a fila e anima palavra por palavra — independente de quantos chunks chegaram.

**2. `setStreamingText(null)` movido para o `catch`**
No caminho de erro, o texto parcial ainda precisa ser limpo. O `catch` zera explicitamente antes de qualquer outra coisa.

**3. Drain `useEffect` → `useLayoutEffect`**
`useEffect` roda após a pintura do browser: haveria um frame em que a mensagem final já aparecia em `messages` antes do drain iniciar (flash). `useLayoutEffect` roda de forma síncrona antes da pintura, garantindo que o drain esconde a mensagem final antes do usuário ver qualquer coisa.

### Erro adicional: "Incomplete JSON segment at the end"
Erro do SDK do Gemini quando a conexão de streaming é cortada antes do último chunk JSON ser completado. Era tratado como "erro inesperado" porque `getGeminiError()` não o reconhecia. Corrigido adicionando `'incomplete json'` à detecção `is503`, fazendo o `withRetry` tentar novamente automaticamente (2x com backoff de 2s/4s).

### Regra para futuras implementações de streaming
Nunca chamar `setStreamingText(null)` no caminho de sucesso após `setStreamingComplete(true)`. O padrão correto é:
```typescript
// ✓ Correto — streamingText mantém o texto para o drain
setStreamingComplete(true);
setMessages(prev => [...prev, modelMessage]);

// ✗ Errado — null colapsa o texto acumulado no mesmo batch
setStreamingComplete(true);
setStreamingText(null);  // ← nunca fazer isso no sucesso
setMessages(prev => [...prev, modelMessage]);
```

---

## Bug: Busca por Tipo de Empresa Retorna 0 Resultados — 29/abr/2026

### Sintoma
Ao perguntar "quais hospitais estão investindo na RM SP sem valor declarado?", a Nadia respondia "encontrei apenas um" ou "não encontrei". Ao ampliar para "saúde", encontrava vários (incluindo hospitais).

### Diagnóstico: o problema não era de dados

A base tem **75 registros de hospitais** na RM SP sem valor declarado. A query SQL com `termo_busca: "hospital"` retornava os 75 corretamente. O problema estava em outra camada.

**Verificação com DuckDB Python:**
```python
import duckdb
conn = duckdb.connect()
conn.execute("CREATE VIEW piesp AS SELECT * FROM 'public/piesp.parquet'")
result = conn.execute("""
  SELECT COUNT(*) FROM piesp
  WHERE (LOWER(regiao) LIKE '%s_o paulo%')
  AND LOWER(CONCAT_WS(' ', empresa_alvo, setor_desc, descr_investimento,
      cnae_inv_2_desc, cnae_inv_descricao, cnae_empresa_descricao)) LIKE '%hospital%'
  AND (reais_milhoes IS NULL OR reais_milhoes = 0)
""").fetchone()[0]
# → 75
```

### Causa Raiz: Dimensionamento do universo de dados sem filtro

A base sem valor tem **2.495 registros só na RM SP**. A função `consultarAnunciosSemValor` retornava `rows.slice(0, 10)` — dez registros em ordem arbitrária do DuckDB. Estatisticamente, nenhum ou apenas 1 desses 10 era um hospital.

O modelo chamava a ferramenta com `{ regiao: "Região Metropolitana de São Paulo" }` **sem** `termo_busca: "hospital"`, porque a descrição do parâmetro era genérica demais ("Termo livre para buscar na descrição") e não deixava claro que era **obrigatório** para filtrar por tipo de empresa.

**Por que "saúde" funcionava e "hospital" não:**
- `cnae_inv_2_desc` = "Atividades de atenção à saúde humana" → contém "saúde" ✓
- Sem `termo_busca`, o modelo recebia 10 registros aleatórios (restaurantes, lojas, etc.)
- "Saúde" era passada como `setor: "Saúde"` → `normalizarArgs` redirecionava para `termo_busca: "saúde"` → a query filtrava por `cnae_inv_2_desc` que contém "saúde"
- "Hospital" muitas vezes só aparece em `cnae_inv_descricao` = "Atividades de atendimento **hospitalar**" — campo correto, mas o modelo precisava de instrução para usá-lo

### Padrão de Falha: "Ilha de Dados"

Este bug exemplifica um padrão recorrente em ferramentas de AI com bases grandes:

> **O modelo chama a ferramenta com filtros insuficientes → recebe uma amostra aleatória → a amostra não representa o universo real → responde incorretamente.**

A ferramenta funcionava perfeitamente quando chamada com os filtros corretos. O problema estava na lacuna entre o que o usuário perguntou e o que o modelo inferiu como parâmetros da tool call.

### Solução em 3 camadas

**Camada 1 — System Prompt (`utils/prompts.ts`):**
Adicionada regra explícita antes das demais regras de processo:
```
REGRA DE FILTRO POR TIPO DE EMPRESA (OBRIGATÓRIA): Quando o usuário
mencionar um tipo específico de empresa ou atividade — hospital, farmácia,
montadora, data center, escola, banco, etc. — SEMPRE passe esse tipo como
`termo_busca` em QUALQUER chamada de ferramenta PIESP.
```

**Camada 2 — Descrição do Tool (`useLiveConnection.ts` e `useChat.ts`):**
A descrição do `consultar_anuncios_sem_valor` ganhou aviso crítico:
```
REGRA CRÍTICA: Se o usuário mencionar um tipo específico de empresa
(hospital, farmácia, montadora, data center, escola, etc.),
OBRIGATORIAMENTE passe esse tipo como `termo_busca`.
Sem esse filtro, a ferramenta retorna 2000+ registros mistos e os
resultados não representarão o tipo solicitado.
```

**Camada 3 — Output da ferramenta (`piespDataService.ts`):**
`consultarAnunciosSemValor` agora retorna:
- Campo `atividade` (`cnae_inv_descricao`) — o modelo vê "Atividades de atendimento hospitalar" e identifica a Rede D'Or como hospital mesmo sem "Hospital" no nome
- Campo `regiao` — permite o modelo confirmar o contexto geográfico
- `ORDER BY empresa_alvo` — resultado alfabético, consistente entre chamadas
- Limite aumentado de 10 → 20 registros
- Retorno unificado com `total_anuncios` (antes retornava array sem contagem total)

### Método de Diagnóstico: Simulação SQL Direta

Antes de qualquer mudança de código, a simulação com Python+DuckDB contra o parquet real provou que os **dados existiam** e a **query SQL estava correta**. Isso descartou bugs de dados/infraestrutura e direcionou a investigação para o comportamento do modelo.

```bash
python3 -c "
import duckdb
conn = duckdb.connect()
conn.execute(\"CREATE VIEW piesp AS SELECT * FROM 'public/piesp.parquet'\")
# Total sem filtro
print(conn.execute('SELECT COUNT(*) FROM piesp WHERE reais_milhoes IS NULL').fetchone())
# Com filtro hospital
print(conn.execute(\"SELECT COUNT(*) FROM piesp WHERE LOWER(cnae_inv_descricao) LIKE '%hospital%' AND reais_milhoes IS NULL\").fetchone())
"
```

**Regra derivada:** Antes de debugar a lógica de prompts ou tool descriptions, sempre simular a query SQL diretamente contra o parquet para confirmar se o problema é de dados ou de comportamento do modelo.

### Branches afetados
Aplicado em `nadia-mobile/0.2.1` (commit `5858c41`) e `feature/v0.3-duckdb-streaming` (commit `c986eae`).

---

## Correções de Qualidade de Resposta — 01/mai/2026

### Verbos de Investimento e Referências Temporais

**Problema:** A Nadia usava "investiu" como verbo padrão e chamava 2025 de "futuro próximo" ao analisar em 2026.

**Causa:** A PIESP registra *anúncios* de intenção, não execuções confirmadas. O modelo não tinha regra explícita sobre verbos, e não sabia a data atual.

**Solução em `utils/prompts.ts` (Seção 6):**
- Injeção dinâmica da data atual: `${new Date().toLocaleDateString('pt-BR', ...)}` na Seção 1 do system prompt. Avaliado no carregamento do módulo — sempre reflete a data do dia.
- Verbo padrão obrigatório: "anunciou", "prevê", "planeja", "destinou". "Investiu" só permitido quando a descrição mencionar explicitamente inauguração ou conclusão de obra.
- Anos passados tratados como histórico, nunca como "futuro próximo".

**Branches afetados:** `nadia-mobile/0.2.1` (commit `2fb6867`) e `feature/v0.3-duckdb-streaming` (commit `bf8f5a5`).

---

## Remoção do Google Search do Gemini Live — 01/mai/2026

### Problema

`{ googleSearch: {} }` estava ativo nas tools do Gemini Live (`useLiveConnection.ts`). Quando o usuário fazia perguntas analíticas sem resposta no PIESP (ex: "existe infraestrutura de qualificação para atender a demanda?"), o modelo tentava usar o grounding nativo do Google. No **Safari/iOS**, essa requisição ao CDN/rede falhava com `TypeError: Load failed sending request`, derrubando o WebSocket inteiro.

O erro se manifestava tanto no chat de voz quanto no chat escrito (onde o mesmo `TypeError` aparecia como "Erro inesperado").

### Distinção entre os dois tipos de Google Search

| Uso | Onde | Mecanismo | Status |
|---|---|---|---|
| Live API (voz) | `useLiveConnection.ts` | Grounding nativo — modelo ativa espontaneamente | **Removido** |
| REST API (aba Empresas) | `PerfilEmpresaView.tsx` via `generateWithFallback` | Passado explicitamente por requisição | **Mantido** |
| REST API (chat escrito) | `useChat.ts` via `searchTools` | Ativado só quando skill `inteligencia_empresarial` detectada | **Mantido** |

### Por que o Live API é diferente

No Live API, `{ googleSearch: {} }` é um grounding built-in — o modelo decide sozinho quando ativá-lo, sem controle do código. A instrução no system prompt ("use somente para inteligência empresarial") é comportamental, não técnica. Para perguntas analíticas sem dados no PIESP, o modelo ignorava a restrição e ativava o grounding, quebrando o WebSocket.

No REST API (`generateContent`), a busca ocorre apenas quando o código passa `tools: [{ googleSearch: {} }]` — é controlada pelo desenvolvedor, não pelo modelo.

### Solução

- `{ googleSearch: {} }` removido das tools do Live API (`useLiveConnection.ts`)
- System prompt atualizado: seção de Google Search substituída por instrução de Inteligência Empresarial baseada em conhecimento de treinamento
- Para company intelligence no chat de voz, o modelo usa seu próprio conhecimento de treinamento — se não souber, declara explicitamente

**Branches afetados:** `nadia-mobile/0.2.1` (commit `8b20519`) e `feature/v0.3-duckdb-streaming` (commit `0d9c45c`).

---

## Bug: DuckDB Warm-up Lazy Causa "Load Failed" na Primeira Pergunta — 01/mai/2026

### Sintoma

Ao fazer a primeira pergunta que exigia consulta ao banco (especialmente perguntas analíticas que o modelo decidia responder com dados), o chat retornava "Erro inesperado: exception TypeError: Load failed sending request". Na segunda tentativa (após perguntas que carregavam o DuckDB com sucesso), a mesma pergunta funcionava.

### Causa Raiz: Inicialização Lazy + Falha Transiente de CDN

O `duckdbService.ts` carrega o worker WASM do DuckDB a partir do **jsDelivr CDN** (`getJsDelivrBundles()`):

```typescript
const workerResponse = await fetch(workerUrl);  // ← CDN externo
```

A inicialização era **lazy** — só ocorria no primeiro tool call. Se o CDN falhasse transientemente nesse momento preciso (Safari com Private Relay, flutuação de rede, CDN cold start), toda a query falhava com `TypeError: Load failed`. Como `initPromise` era zerado no erro (permite retry), a próxima tentativa carregava o DuckDB com sucesso.

O padrão de falha: "funciona na segunda vez" é diagnóstico clássico de inicialização lazy com recurso externo instável.

### Solução

**1. Warm-up eager em `ChatView.tsx` e `VoiceView.tsx`:**
```typescript
useEffect(() => { getDbConnection().catch(() => {}); }, []);
```
DuckDB começa a carregar imediatamente ao montar a view, antes de qualquer interação do usuário. O catch vazio é intencional — erros de init serão tratados quando a primeira ferramenta for chamada.

**2. "load failed" como erro retentável em `useChat.ts` e `withRetry`:**
```typescript
const isRetryable = ... || msg.includes('load failed');
```
Se o CDN ainda falhar após o warm-up, o `withRetry` tenta mais 2 vezes (2s / 4s) em vez de exibir "Erro inesperado" imediatamente.

**3. Bug colateral corrigido:** `useChat.ts` do v0.3 ainda usava `.length` no retorno de `consultarAnunciosSemValor` (que mudou para `{ total_anuncios, anuncios[] }` em abril). Corrigido para `.total_anuncios`.

**Branches afetados:** `nadia-mobile/0.2.1` (commit `47c0de9`) e `feature/v0.3-duckdb-streaming` (commit `1e4e61e`).

---

## Reescrita das Skills Analíticas com Linguagem Técnica de Domínio — mai/2026

### Motivação

As 8 skills analíticas (`skills/*.md`) foram reescritas para produzir análises com linguagem técnica de domínio em vez de descrições genéricas de setor. O problema identificado: o modelo descrevia cada empresa individualmente em vez de sintetizar o padrão do conjunto.

### Mudanças por skill

| Skill | Conteúdo técnico adicionado |
|---|---|
| `qualificacao_profissional.md` | Mapeamento CNAE→CBO (14 setores), tempo de formação por nível, gap estrutural vs incremental |
| `emprego_empregabilidade.md` | Multiplicadores direto/indireto por setor, taxa de formalidade, passivo de serviços públicos (1000 trabalhadores = ~300 crianças em idade escolar) |
| `logistica_infraestrutura.md` | Capacidade modal por tipo de carga, specs Porto de Santos (5M TEUs, calado 13,2m), quantificação de energia (50–500 MW data centers) e água (300–800k L/dia) |
| `inovacao_tecnologia.md` | Tabela de intensidade tecnológica OCDE por CNAE, Lei do Bem/FAPESP PIPE como sinais de P&D, paradoxo do spillover (data centers = zero spillover local) |
| `desenvolvimento_regional.md` | Teoria da base econômica, ilusão fiscal da Lei Kandir, passivo de serviços públicos quantificado |
| `cadeias_produtivas.md` | Arquétipo Tier 0/1/2/3, coeficientes de encadeamento frente/trás, "ilha industrial" como padrão de risco |
| `transicao_energetica.md` | Classificação GHG Protocol Escopo 1/2/3, intensidade tCO₂e por setor, SBCE/CBAM/CBIOs, risco de stranded asset |
| `comercio_exterior.md` | Regimes DRAWBACK/ex-tarifário/CBAM, distinção E1G vs E2G para CBAM (E2G = vantagem competitiva, não risco), propensão exportadora por setor, barreiras anti-dumping/SPS |

### Padrão anti-lista adicionado a todas as skills

Cada skill ganhou uma seção "Como estruturar a síntese (anti-lista)" com:
- Instrução para identificar padrão do conjunto antes de citar empresas
- Regras específicas da especialidade (ex: comércio exterior: verificar produto real antes de classificar propensão exportadora)
- Exemplos de anti-padrões a evitar

### Mudanças no `SYSTEM_INSTRUCTION` (`utils/prompts.ts`)

Seis regras novas foram adicionadas:

1. **Anti-narração cronológica** (Seção 2): nunca narrar empresa por empresa; estrutura obrigatória em 5 passos (padrão dominante → hipótese → evidência → tensões → insight não-óbvio)
2. **Regra de omissão por ressalva** (Seção 2): se o modelo escreveu "embora seja predominantemente doméstico" → omitir o investimento, não ressalvá-lo
3. **Expressões temporais vagas não geram filtro de ano** (Seção 3): "nos últimos anos", "recentemente" nunca viram `ano: "2024"`
4. **Cidades que nomeiam RA usam `regiao`, não `municipio`** (Seção 3): "Campinas" → `regiao: "RA Campinas"`
5. **Exclusividade de lente** (Seção 5): quando uma lente está ativa, as outras 7 ficam suspensas
6. **Conhecimento de treinamento como contexto** (Seção 5): cluster sub-representado nos dados é insight analítico, não lacuna a ignorar
7. **Auto-revisão** (Seção 6 — nova): 5 testes de qualidade que o modelo deve aplicar antes de responder

---

## Arquitetura de Crítica em Duas Chamadas no Chat — mai/2026

### Problema

Mesmo com as regras no `SYSTEM_INSTRUCTION`, a primeira chamada ao modelo produzia respostas que:
- Listavam investimentos um por um (narração por empresa)
- Incluíam investimentos com ressalvas ("Magazine Luiza, embora focado no mercado interno...")
- Omitiam o cluster dominante da região (ex: calçados em Franca)
- Concluíam de forma genérica ("desenvolvimento contínuo", "tem potencial")

O prompt-only tem um teto de confiabilidade. O modelo segue as regras parcialmente, não integralmente.

### Solução: `critiqueCandidateResponse` em `hooks/useChat.ts`

Após a primeira chamada produzir `finalText`, uma segunda chamada roda silenciosamente antes de `setStreamingComplete(true)`:

```typescript
const activeSkillForCritique = selectedSkillName || detectedSkill?.name;
if (activeSkillForCritique && !usarPesquisa && finalText && finalText.length > 300 && mode === 'complete') {
  const refined = await critiqueCandidateResponse(ai, text, finalText, activeSkillForCritique);
  if (refined) finalText = refined;
}
```

**Configuração da chamada de crítica:**
- Modelo: `gemini-2.5-flash` (mesmo)
- `thinkingBudget: 0` (rápida, sem raciocínio profundo)
- Sem tools (processamento de texto puro)
- ~4–6s adicionais de latência

### Mecânica de UX (sem flash visível)

A arquitetura do drain em `ChatView.tsx` garante que a troca é imperceptível:

1. Primeira resposta acumula em `streamingText` → `displayText` anima palavra por palavra
2. Crítica roda enquanto `isLoading = true` (bloqueia novo envio)
3. Se refinada: `finalText` é substituído antes de `setStreamingComplete(true)`
4. `setStreamingComplete(true)` → drain anima o texto da 1ª resposta
5. Quando drain termina: a mensagem em `messages` revela — já com a versão refinada
6. Para respostas longas (>400 palavras): drain leva ~9s; crítica leva ~5s → crítica termina durante o drain → mensagem refinada revela ao final sem jump visível

**Por que o drain esconde o jump:** linha 443 de `ChatView.tsx`:
```tsx
if (displayText && streamingComplete && index === messages.length - 1 && msg.role === 'model') return null;
```
A última mensagem fica oculta enquanto `displayText` está ativo.

### Os 5 testes da crítica

| Teste | O que verifica | Ação quando falha |
|---|---|---|
| 1 — Omissão por ressalva | Investimentos com "sem impacto direto", "pode haver um potencial, mas..." | Remove o investimento completamente |
| 2 — Cluster dominante | Cluster da região está no corpo principal (não como nota de rodapé) + E2G/CBAM correto | Reescreve abertura com cluster em destaque; corrige E2G = vantagem |
| 3 — Estrutura de lista | ≥3 parágrafos começando com nome de empresa/setor | Reescrita completa em 4 parágrafos (padrão → hipótese → evidência → insight) |
| 4 — Conclusão genérica | Frases como "tem potencial", "desenvolvimento contínuo" | Substitui por insight específico |
| 5 — Contaminação de lente | Análises de outras especialidades presentes | Remove trechos de outras lentes |

### Condições de ativação

A crítica só roda quando:
- Skill ativa (`selectedSkillName` ou auto-detectada)
- NÃO é pesquisa web (`!usarPesquisa`) — Google Search não entra na crítica
- Resposta substantiva (`finalText.length > 300`)
- Modo `complete` (não `fast`)

### Fallback silencioso

Se a crítica falhar (503, quota, timeout), `finalText` original é usado sem interrupção da UX. O erro é logado como `⚠️ [Critique] Falhou silenciosamente`.

### Logs no console

```
✏️ [Critique] Revisando com lente "comercio_exterior"...
✏️ [Critique] Resposta refinada.
— ou —
✓ [Critique] Aprovada sem modificações.
```

**Branch afetado:** `feature/v0.3-duckdb-streaming`
