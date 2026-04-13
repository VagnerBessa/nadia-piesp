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

**Problema 6 — Filtro de região retorna 0 no Chat (BUG EM ABERTO)**

**Data:** Abril de 2026. **Status: não resolvido.**

**Sintoma:** O Chat retorna "Não foram encontrados projetos" para perguntas como "investimentos de comércio na Região Metropolitana de São Paulo", mesmo com dados confirmados na base. A aba Explorar funciona corretamente com os mesmos filtros.

---

### Diagnóstico correto: o problema é exclusivamente o filtro de região no Chat

**Por que o Explorar funciona:**

`getMetadados()` (linha 393 de `piespDataService.ts`) trata setores e regiões de forma diferente:
- **Setores** (linha 410): `canonicalSetor(setor)` → dropdown mostra nomes canônicos em Unicode correto (`"Comércio"`, `"Indústria"`)
- **Regiões** (linha 411): `regioes.add(regiao)` → valor bruto do CSV, garbled (`"RA S\uFFFDo Paulo"`)

Então no Explorar, quando o usuário seleciona uma região do dropdown, o `filtro.regiao` é o mesmo string garbled que está no CSV. Em `regiaoMatchPorNome`, ambos os lados da comparação são garbled e idênticos → match imediato na primeira linha.

**Por que o Chat falha:**

O Gemini gera `"Região Metropolitana de São Paulo"` (Unicode correto). Esse valor é comparado contra `"RA S\uFFFDo Paulo"` (garbled do CSV) → nenhuma das comparações em `regiaoMatchPorNome` funciona.

**O filtro de setor também falha no Chat.**

Afirmei anteriormente que `canonicalSetor()` resolveria o setor no Chat — essa afirmação estava errada. O setor continua retornando 0. Como removemos os logs antes de confirmar, não sei qual argumento o Gemini está passando para a ferramenta: se usa `setor: "Comércio"` (canonical) ou `termo_busca: "comércio"` (texto livre), ou se `canonicalSetor()` tem um bug de cobertura. Sem logs, não é possível diagnosticar.

**Ambos os filtros — setor e região — falham no Chat.**

---

### Por que a correção com `normAsciiOnly` não funcionou

A hipótese era: remover todos os não-`[a-z]` de ambos os lados produziria strings idênticas.

Isso funciona para a comparação direta (linhas 169–171 de `piespDataService.ts`):
```
normAsciiOnly("RA S\uFFFDo Paulo")         = "rasopaulo"
normAsciiOnly("Região Metropolitana...")   = "regiometropolitanadesopaulo"
```
`bb.includes(aa)`? `"regiometropolitanadesopaulo".includes("rasopaulo")`? **Não** — não existe a sequência `ra...s` nessa string.

Então o código cai no caminho `stripPrefix` + `normAsciiOnly` (linhas 173–175). E aqui está o erro:

`stripPrefix` recebe o resultado de `norm()`, não a string bruta. E `norm()` trata U+FFFD e ã de forma assimétrica:
- `norm("São Paulo")`: NFD decompõe `ã` → `a` + combining tilde → strip combining → **`"sao paulo"`** (`a` preservado)
- `norm("S\uFFFDo Paulo")`: U+FFFD não é diacrítico, não é tocado → **`"s\uFFFDo paulo"`** (sem `a`)

Após `stripPrefix` e `normAsciiOnly`:
| Origem | Após norm + stripPrefix | Após normAsciiOnly |
|---|---|---|
| `"RA S\uFFFDo Paulo"` (CSV garbled) | `"s\uFFFDo paulo"` | **`"sopaulo"`** |
| `"Região Metropolitana de São Paulo"` (Gemini) | `"sao paulo"` | **`"saopaulo"`** |

`"sopaulo" ≠ "saopaulo"` → ainda sem match. O `a` de `ã` é recuperado por `norm()` no caminho Unicode correto, mas não existe no caminho garbled. `normAsciiOnly` joga fora o `a` de um lado mas não do outro.

O fallback por municípios (`resolverRegiaoEmMunicipios`) falha pelo mesmo motivo: o set `RMSP` contém `"sao paulo"` (normalizado com `a`), mas `norm("s\uFFFDo paulo")` produz `"s\uFFFDo paulo"` — não está no set.

---

### Falhas de método (autocrítica)

1. **Depuramos sem visibilidade.** Removemos os logs de diagnóstico antes de confirmar que o bug foi resolvido. O correto seria: manter logs → testar → confirmar → remover.

2. **Empilhamos correções sem isolar cada uma.** Não sabemos com certeza se `canonicalSetor` está ou não funcionando para Chat, porque nunca testamos apenas o setor isolado (sem região).

3. **Nunca validamos a hipótese com um teste simples antes de implementar.** Um `console.assert` no console do browser teria revelado imediatamente que `normAsciiOnly(norm("S\uFFFDo Paulo"))` ≠ `normAsciiOnly(norm("São Paulo"))`.

4. **Confundimos "a análise faz sentido" com "o código vai funcionar".** A interação entre `norm()` e `normAsciiOnly` tinha um comportamento assimétrico que não foi percebido antes de escrever o código.

---

### Solução correta

O filtro de região precisa comparar a string garbled do CSV com a string Unicode correta do Gemini. Existem dois caminhos:

**Caminho A — Corrigir o encoding do CSV na origem (recomendado):**
Decodificar o CSV com Latin-1 antes de parsear. Resolve todos os problemas de encoding de uma vez.

O Vite não suporta `?raw` com encoding customizado, mas é possível via script de pré-build:

```js
// scripts/convert-csvs.js
import { readFileSync, writeFileSync } from 'fs';
const buf = readFileSync('knowledge_base/piesp_confirmados_com_valor.csv');
const text = new TextDecoder('latin-1').decode(buf);
writeFileSync('knowledge_base/piesp_confirmados_com_valor.utf8.csv', text, 'utf-8');
```

Adicionar `"prebuild": "node scripts/convert-csvs.js"` ao `package.json`. Mudar os imports para `.utf8.csv`. Com isso, `regiaoMatchPorNome` funciona sem modificações — `norm("RA São Paulo")` = `norm("RA São Paulo")` → match.

**Caminho B — Corrigir `municipioNaRegiao` com duplo lookup:**
O fallback de municípios (`resolverRegiaoEmMunicipios`) já identifica `"Região Metropolitana de São Paulo"` corretamente (a função usa `norm()` e o set `REGIAO_MUNICIPIOS` tem `"metropolitana de sao paulo"` como termo). O problema é que `municipioNaRegiao` falha para municípios garbled.

Adicionar ao set `RMSP` as versões `normAsciiOnly` dos nomes garbled, e checar ambas:
```typescript
function municipioNaRegiao(municipioNaBase: string, municipiosRegiao: Set<string>): boolean {
  const m = norm(municipioNaBase);
  if (municipiosRegiao.has(m)) return true;
  // fallback para garbled: normAsciiOnly remove o U+FFFD
  const mAscii = normAsciiOnly(municipioNaBase);
  return municipiosRegiao.has(mAscii);
}
```
E adicionar entradas `normAsciiOnly`-d ao set `RMSP` (ex: `"sopaulo"` para `"São Paulo"`). É um hack, mas menor escopo que o Caminho A.

O Caminho A é definitivo e limpo. O Caminho B resolve só o fallback de município, não o match direto por nome de região.

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

### find-skills

Instalada em `.agents/skills/find-skills/` (symlink em `.claude/skills/find-skills`).

**O que faz:** descobre e instala skills do ecossistema open agent skills. Útil quando o usuário pergunta "existe uma skill para X?" ou "como faço Y?" — a skill pesquisa no repositório e sugere o que instalar.

**Comandos principais do CLI:**
```bash
npx skills find [query]   # busca skills por palavra-chave
npx skills add <pacote>   # instala uma skill do GitHub
npx skills check          # verifica atualizações
npx skills update         # atualiza todas as skills instaladas
```

**Catálogo público:** https://skills.sh/

**Como usar:** invoque com `/find-skills` descrevendo o que precisa. Exemplo: `/find-skills preciso de uma skill para escrever testes`.

**Instalação:**
```bash
npx skills add https://github.com/vercel-labs/skills --skill find-skills
```

### frontend-design

Instalada em `.agents/skills/frontend-design/` (anthropics/skills).

**O que faz:** guia a criação de interfaces com design intencional e diferenciado — evita padrões genéricos. Define direção estética antes de codificar (minimalismo, bold, retro-futurista, etc.) e executa com tipografia, paleta e composição espacial coerentes.

**Quando ativa:** ao construir novos componentes, views ou refinar UI existente.

**Instalação:**
```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design
```

### vercel-react-best-practices

Instalada em `.agents/skills/vercel-react-best-practices/` (vercel-labs/agent-skills).

**O que faz:** 69 regras de performance para React organizadas em 8 categorias — eliminar waterfalls, otimizar bundle, evitar re-renders, data fetching correto, padrões avançados. Cada regra inclui exemplos incorreto/correto.

**Quando ativa:** ao escrever ou revisar componentes React e hooks.

**Instalação:**
```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
```

### web-design-guidelines

Instalada em `.agents/skills/web-design-guidelines/` (vercel-labs/agent-skills).

**O que faz:** audita código de UI contra acessibilidade, padrões de design e UX — funciona como linter visual. Retorna achados no formato `arquivo:linha`.

**Quando ativa:** ao pedir "revise minha UI", "audite o design" ou "verifique acessibilidade".

**Instalação:**
```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines
```

---

## MCP Server (`mcp-server/`)

### Abril/2026 — Branch `claude/review-ag-ui-I7D3s`

Servidor MCP (Model Context Protocol) independente que expõe os dados da PIESP para qualquer cliente compatível — Claude Desktop, Hermes Agent, Cursor, Windsurf, etc.

**Motivação:** A arquitetura web (browser + Gemini) não tem backend, o que impede outros agentes de consultar os dados da PIESP. O MCP server resolve isso sem alterar nada da web app existente.

**Localização:** `mcp-server/` — pacote Node.js independente dentro do mesmo repositório.

```
mcp-server/
├── package.json         ← @modelcontextprotocol/sdk + express
├── tsconfig.json        ← NodeNext ESM
└── src/
    ├── piespService.ts  ← porta do piespDataService.ts (fs.readFileSync em vez de ?raw)
    └── index.ts         ← servidor MCP com 5 tools
```

**Tools expostas:**

| Tool | Equivalente no Gemini | Descrição |
|---|---|---|
| `consultar_projetos_piesp` | tool 1 `piespTools` | Top 10 projetos por valor com filtros livres |
| `consultar_anuncios_sem_valor` | tool 2 `piespTools` | Anúncios sem valor declarado |
| `filtrar_para_relatorio` | `filtrarParaRelatorio()` | Agregações completas por setor/região/ano |
| `get_metadados` | `getMetadados()` | Valores únicos disponíveis na base |
| `buscar_empresa` | `buscarEmpresaNoPiesp()` | Todos os projetos de uma empresa |

**Transporte dual:**

| Modo | Como ativar | Para quem |
|---|---|---|
| stdio (padrão) | `node dist/index.js` | Claude Desktop, Cursor, IDEs |
| HTTP + SSE | `PORT=3456 node dist/index.js` | Hermes Agent, clientes de rede |

Em modo HTTP: `GET /sse` abre stream; `POST /messages?sessionId=X` envia mensagens; `GET /health` status.

**Instalação e uso:**
```bash
cd mcp-server
npm install
npm run build
npm start           # stdio
# ou
npm run start:http  # HTTP na porta 3456
```

**Para Claude Desktop** — adicionar em `~/.claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "piesp": {
      "command": "node",
      "args": ["/caminho/para/nadia-piesp/mcp-server/dist/index.js"]
    }
  }
}
```

**Para Hermes Agent** — adicionar URL do SSE nas configurações de MCP do Hermes:
```
http://localhost:3456/sse
```

**Decisão arquitetural — por que não alterar a web app:**
A web app usa Vite `?raw` para importar os CSVs diretamente no bundle do browser. O MCP server usa `fs.readFileSync` para ler os mesmos arquivos do filesystem. A lógica de filtro foi portada sem mudanças de comportamento. Os dois sistemas são independentes e leem da mesma fonte (`knowledge_base/`).

**Nota:** Os CSVs estão em `.gitignore` (arquivos grandes). Para usar o MCP server, copiar `piesp_confirmados_com_valor.csv` e `piesp_confirmados_sem_valor.csv` para `knowledge_base/`. O server avisa no stderr se os arquivos não forem encontrados e continua rodando (retorna resultados vazios).

---

## Convenções

- Novas views: prop `onNavigateHome: () => void`, header interno próprio, botão "Voltar"
- Navegação centralizada em `App.tsx` (state machine com `useState<View>`)
- `Header.tsx` recebe callbacks opcionais — adicionar prop ao interface ao incluir nova view
- Tailwind dark-first; paleta: `slate-*` fundos/texto, `rose-*` destaques/ações, `sky-*` links/citações
