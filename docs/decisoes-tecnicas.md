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

## Por que o encoding do CSV não foi corrigido na origem ainda

O CSV da PIESP está em Latin-1. O Vite importa via `?raw` como UTF-8. Acentos viram U+FFFD.

**Por que não foi corrigido:** a solução correta (script de pré-build convertendo para UTF-8) foi identificada mas não implementada porque a sessão de debug foi encerrada antes. As tentativas de workaround em runtime (`normAsciiOnly`, `canonicalSetor`) resolvem parte do problema mas não tudo.

**Por que não usar workarounds adicionais:** cada workaround em cima de encoding corrompido adiciona complexidade frágil. A solução é corrigir na origem.

Ver BUG-001 em `docs/bugs-abertos.md` para análise completa.
