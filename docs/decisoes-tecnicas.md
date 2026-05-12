# Decisões Técnicas

Raciocínio por trás das escolhas arquiteturais — por que foi feito assim e não de outra forma.
Útil para não repetir experimentos que já falharam e para entender trade-offs conscientes.

---

## Por que Function Calling em vez de contexto longo para dados tabulares

**Tentativa:** carregar o CSV inteiro na `systemInstruction` do Gemini.

**O que aconteceu:** com 5.000 linhas de dados tabulares densos, o modelo alucinava. Perguntado sobre "principais investimentos em 2026", inventava valores. LLMs não agem como bancos de dados SQL — a atenção se dilui com volume tabular, o modelo interpola em vez de filtrar.

**Decisão:** Function Calling com `piespDataService.ts`. O modelo chama a ferramenta, o JavaScript filtra deterministicamente, devolve JSON compacto. O modelo só interpreta e apresenta.

**Regra derivada:** texto narrativo vai no contexto longo. Dados tabulares vão em tools. Ver `CLAUDE.md` para a tabela completa.

---

## Por que `piespTools` e `searchTools` não podem ser combinados

Não é escolha — é limitação da API Gemini. Function declarations e Google Search grounding são mutuamente exclusivos na mesma chamada de `generateContent`.

**Consequência:** `useChat.ts` detecta a skill ativa e escolhe um conjunto ou outro. Views que precisam de ambos (ex: `PerfilEmpresaView`) fazem chamadas separadas ou usam só uma das ferramentas.

---

## Por que dois serviços de dados separados

- `piespDataService.ts` — filtro por registro, retorna até 10 projetos. Usado em function calling onde o modelo precisa de dados pontuais.
- `piespDashboardData.ts` — single-pass sobre todo o CSV, agrega tudo de uma vez, resultado cacheado como singleton. Usado em dashboards onde o custo de reparsing seria alto.

Unificar os dois criaria um serviço que tenta ser tudo — ou lento demais para consultas pontuais, ou complexo demais para agregações. A separação reflete padrões de uso genuinamente diferentes.

---

## Por que a skill de design do DataLab não passa pelo `skillDetector`

As skills em `skills/` são **lentes analíticas de domínio** — ativadas por palavras-chave quando o usuário pergunta sobre um tema específico (ex: inteligência empresarial).

A skill de design (`skills/datalab_design.md`) é **procedimental** — controla o formato de saída (JSON estruturado com tipos de componentes), não o conteúdo analítico. Ela é sempre necessária no DataLab, independente do que o usuário perguntou. Por isso é injetada diretamente no prompt do DataLab, não via `skillDetector`.

---

## Por que o MCP server é uma cópia e não um import compartilhado

`piespService.ts` (MCP server) é uma cópia de `piespDataService.ts` (web app). A duplicação é intencional por agora:

- A web app usa Vite `?raw` para importar CSVs — funciona só no browser
- O MCP server usa `fs.readFileSync` — funciona só em Node.js
- Compartilhar o código exigiria abstrair o mecanismo de leitura, adicionando complexidade sem benefício imediato

**Quando resolver:** quando Nadia ganhar backend. Nesse ponto o browser para de ler CSV diretamente e o único leitor é o servidor — a duplicação desaparece naturalmente. Ver `docs/arquitetura.md`.

---

## Por que prompts de gráficos usam ordens estritas em vez de sugestões

**Tentativa:** instrução "se julgar visualmente útil, insira um gráfico".

**O que aconteceu:** o modelo gerava 1 gráfico de barras genérico e ignorava o resto. LLMs otimizam para o mínimo esforço — instruções abertas produzem resultados mínimos.

**Decisão:** ordens estritas com mínimos absolutos ("pelo menos 2 gráficos de frentes diferentes") e tipos obrigatórios por contexto (`line` para evolução temporal, `pie` para proporção). O modelo respeita mínimos quando explícitos.

---

## Por que o pie chart tem defesa dupla (prompt + componente)

O prompt instrui o modelo a nunca gerar mais de 5 fatias. O componente `capPieData` agrupa excedentes em "Outros" independente do que o modelo retornou.

Modelos de linguagem não seguem instruções 100% das vezes. A defesa no componente é determinística e silenciosa — age como rede de segurança sem depender do comportamento do modelo.

Padrão geral: **instrução no prompt + guardrail no código**. O prompt define a intenção, o código garante o limite.

---

## Por que o DataLab revela seções progressivamente em vez de fazer streaming real de texto

O DataLab gera um objeto `DashboardData` estruturado (JSON com gráficos, KPIs, tabelas). Não há texto contínuo para fazer streaming token a token como no PerfilEmpresaView.

**Tentativa descartada:** transmitir o JSON bruto caracter a caracter. O efeito visual seria incoerente — fragmentos de JSON parcial causariam erros de parse e a interface piscaria.

**Decisão:** revelar `dashboard.secoes.slice(0, revealedCount)` incrementando `revealedCount` a cada ~420ms. O resultado visual é idêntico ao streaming (conteúdo aparece progressivamente, cursor pisca, scroll automático acompanha), mas a fonte é o objeto já parsado — sem risco de parse parcial.

**Regra derivada:** streaming visual não precisa ser streaming real de bytes. O que importa é que o usuário veja o conteúdo sendo "construído" — a ilusão pode ser criada com revelação progressiva de unidades semânticas (seções, parágrafos, itens de lista).

---

## Por que o `still` prop do CapivaraPet deve ser aplicado após o bloco `wrapperAnim`

`still` substitui qualquer animação do wrapper por `'none'`. A linha `if (still) wrapperAnim = 'none'` deve aparecer **depois** de todo o bloco de atribuição de `wrapperAnim`.

**O que aconteceu quando estava antes:** colocar o `if (still)` antes da declaração `let wrapperAnim` causou erro de compilação TypeScript ("Block-scoped variable used before declaration"). A página ficava em branco sem mensagem de erro clara no console.

**Regra derivada:** qualquer prop que sobrescreve uma variável local computada deve ser aplicada no final do bloco de computação, não no início.

---

## Por que subgrafos isolados derivam para longe no grafo de rede (e como corrigir)

Em grafos com componentes desconectados (nós sem caminho até o cluster principal), a força de repulsão `charge` empurra esses nós para longe, mas nenhuma aresta os puxa de volta. O resultado visual: pequenos conglomerados aparecem a centenas de unidades do cluster principal.

**Solução aplicada em `GraphCanvas.tsx`:**

1. **Força de atração customizada (`attract`):** a cada tick subtrai `k * posição * alpha` da velocidade de cada nó, puxando-os suavemente em direção à origem. Nós próximos ao centro mal sentem; nós distantes recebem correção proporcional à distância.

2. **`distanceMax(350)` no charge:** limita o raio de repulsão a 350 unidades. Sem isso, a repulsão entre nós muito separados ainda contribui para afastá-los; com o limite, nós além de 350 unidades se tornam invisíveis para a força de repulsão.

**Por que não usar `forceCenter` do d3 sozinho:** `forceCenter` é zero-sum (desloca o centróide para a origem mas não aplica força restauradora por nó). Não impede dispersão de componentes isolados.

**Parâmetro de tuning:** `k = 0.04`. Valores acima de ~0.08 colapsam o grafo em torno da origem destruindo a separação de clusters.

---

## Por que o contexto de voz do Dashboard foi reescrito inline

`getDashboardContext()` retornava apenas 6 linhas (totais + top 3 setores + top 3 municípios). Quando o usuário pedia à esfera para descrever os dados visíveis, o modelo não tinha material suficiente e ou inventava ou dava respostas genéricas.

**Solução:** `dashboardSystemInstruction` em `PiespDashboardView.tsx` constrói o contexto diretamente a partir de `data` (já carregado no componente), incluindo série histórica completa, top 8 setores, top 10 municípios, top 10 empresas, concentração espacial e filtro de ano ativo.

**Regra derivada:** o contexto de voz deve incluir exatamente o que está visível na tela — não um resumo do resumo. Se o componente já tem os dados, não há razão para passar por uma função auxiliar que os trunca.

---

## Por que o pet do Dashboard usa `withBook` fixo em vez de depender do estado

O livro é renderizado em `CapivaraPet` quando `isReading || withBook`. Quando o estado muda de `'reading'` para `'speaking'` ou `'listening'` durante o diálogo de voz, `isReading` vira `false` e o livro desaparece.

**Solução:** passar `withBook={true}` fixo. O prop garante o livro independentemente do estado — o estado continua controlando animação, direção dos olhos e respiração, mas não mais a presença do acessório.

**Regra derivada:** acessórios visuais permanentes (`withBook`, `withGlasses`) devem ser declarados explicitamente, não inferidos do estado. Estado é comportamento; acessório é identidade visual.

---

## Por que o olhar do pet usa `pupilOffset` e não troca de estado

Para o pet olhar para a esfera (direita) quando ela fala e para frente quando o usuário fala, a alternativa óbvia seria criar dois estados novos (`looking_right`, `looking_forward`). Isso poluiria o enum de estados com lógica específica de uma única tela.

**Solução:** `pupilOffset` prop — sobrescreve a posição das pupilas sem alterar estado, animação ou acessórios. `isSpeaking → { dx: 10, dy: -2 }` (direita, onde a esfera está); `isListening → { dx: 0, dy: 0 }` (frente); sem conexão → `undefined` (comportamento padrão do estado).

**Regra derivada:** `pupilOffset` é a válvula de escape para direcionamento pontual sem criar estados novos. Usar quando o direcionamento é contextual de uma tela específica, não um comportamento reutilizável.

---

## Por que o GraphCopilot tem escopo analítico e não apenas descritivo

A primeira versão do system prompt restringia a Nadia a descrever apenas os dados do grafo (nós, arestas, métricas). Perguntas como "o que essa estrutura sugere economicamente?" eram recusadas como fora do escopo.

**O que aconteceu:** respostas excessivamente descritivas e literais — o modelo listava fatos sem interpretar. O valor de um assistente de grafo está precisamente na interpretação econômica da estrutura.

**Decisão:** reescrever o prompt com ancoragem obrigatória (toda análise parte dos dados do grafo) + liberdade analítica (hipóteses econômicas, relações setoriais, padrões estruturais). Salvaguardas metodológicas permanecem, mas são sinalizadas só quando relevante — não repetidas mecanicamente.

**Parâmetro de calibração:** dados citados de forma compacta numa frase; interpretação se desenvolve a seguir sem repetir os dados. Limite: 2–3 frases para consultas simples, até 6 para análises estruturais.

---

## Por que o encoding do CSV não foi corrigido na origem ainda

O CSV da PIESP está em Latin-1. O Vite importa via `?raw` como UTF-8. Acentos viram U+FFFD.

**Por que não foi corrigido:** a solução correta (script de pré-build convertendo para UTF-8) foi identificada mas não implementada porque a sessão de debug foi encerrada antes. As tentativas de workaround em runtime (`normAsciiOnly`, `canonicalSetor`) resolvem parte do problema mas não tudo.

**Por que não usar workarounds adicionais:** cada workaround em cima de encoding corrompido adiciona complexidade frágil. A solução é corrigir na origem.

Ver BUG-001 em `docs/bugs-abertos.md` para análise completa.
