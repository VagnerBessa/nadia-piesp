# Roadmap do Ecossistema Seade

**Data:** Abril de 2026
**Contexto:** Fases de expansão do projeto Nadia para um ecossistema completo de análise de dados do Seade.

---

## Fase 1 — Fundação (concluída)

- ✅ Nadia-PIESP: web app com chat, voz, dashboards, Data Lab
- ✅ MCP server da PIESP: expõe 5 tools via stdio e HTTP/SSE
- ✅ Skills analíticas: 9 lentes de domínio (emprego, inovação, logística, etc.)
- ✅ Skill de design: regras visuais para dashboards generativos

---

## Fase 2 — Hermes como cérebro persistente

**Objetivo:** conectar o Hermes Agent ao MCP server da PIESP e validar o padrão antes de escalar.

Ações:
- Definir servidor para hospedar o Hermes (servidor próprio do Seade preferível — ver `dados.md`)
- Instalar e configurar o Hermes Agent
- Conectar ao `piesp-mcp-server` via SSE (`http://servidor:3456/sse`)
- Testar queries via Telegram com analistas do Seade
- Documentar padrões de uso que o Hermes aprende nas primeiras semanas

**Critério de sucesso:** um analista consegue responder perguntas sobre PIESP via Telegram sem abrir o navegador.

---

## Fase 3 — Segunda Nadia (base a definir)

**Candidatos:**
- **Nadia Municipal:** 645 municípios × 60 indicadores × 20 anos — base estruturada, alta demanda interna
- **Nadia Emprego:** dados do mercado de trabalho formal (CAGED + pesquisas Seade)

Cada nova Nadia segue o padrão estabelecido:
1. CSV em `knowledge_base/`
2. `piespDataService.ts` equivalente para a nova base
3. Function calling no Gemini
4. MCP server paralelo para o Hermes

O Hermes passa a ter dois domínios e pode iniciar respostas cruzadas.

---

## Fase 4 — Queries cruzadas

Com dois ou mais MCP servers ativos no Hermes:

> *"Quais municípios receberam mais investimento industrial entre 2020 e 2024 e também tiveram crescimento de emprego formal acima da média do estado?"*

Nenhuma Nadia isolada responderia isso. O Hermes cruza `piesp-mcp` + `emprego-mcp` numa única resposta.

Esse é o ponto de inflexão: o ecossistema começa a gerar inteligência que não existia antes.

---

## Fase 5 — Infraestrutura de dados compartilhada (futuro)

Se as bases crescerem além dos limites do CSV (~50.000 linhas) ou se houver necessidade de atualização em tempo real:

- Migrar MCP servers para SQLite (sem backend, ganho de performance)
- Avaliar Supabase Self-Hosted para dados compartilhados entre Nadias
- Implementar controle de acesso se bases contiverem dados sensíveis

Essa fase é opcional e não bloqueia nenhuma das anteriores.

---

## Princípio que guia o roadmap

Cada fase entrega valor independente. Fase 2 não depende de Fase 3 estar pronta. Fase 3 não depende de Supabase. O ecossistema cresce de forma incremental — sem grandes reescritas, sem quebrar o que funciona.

---

## 🚧 Backlog Técnico Prioritário: Engenharia de Tradução Lexical

Para blindar o sistema governamental contra alucinações ("Type 2"), foi vetado o uso de abordagens "Text-to-SQL" ou modelos interativos soltos (Semantic Routing) em canais de voz devido à latência de gerar multiplos turnos. Como consequência, o banco exige chaves sintáticas exatas, gerando **Fricção de Vocabulário** do lado do cidadão (ex: dizer "lojista" ao invés de "CNAE 47").

As seguintes pendências devem ser obrigatoriamente implementadas, divididas por complexidade:

### [PENDÊNCIA] 1. Enums + Tool Descriptions (Curto Prazo / Fases 1 e 2)
**Status:** ⬜ A Fazer
A ser aplicado em dicionários pequenos (Setores PIESP, Macrorregiões).
- **Como funciona:** Expandir o objeto de configuração (JSON Schema) de cada Tool enviada ao Gemini. Especificar estritamente o tipo de campo com uma matriz fechada `enum: ['valor_1', 'valor_2']` contendo as variáveis reais do banco de dados (isolando criatividade da IA).
- **A Função do LLM:** Usa-se a chave booleana de descrição interna (`description`) instruindo a IA sobre qual palavra mapear. Ex: *"Description: Mapeie qualquer intenção do usuário contendo palavras como receita, faturamento ou lucros OBRIGATORIAMENTE para a string 'venda_varejo'."*
- **Vantagem:** Latência zero no acionamento por Voz. Tudo é resolvido em *zero-shot* no *Prompting* de função primário.

### [PENDÊNCIA] 3. RAG Lexical Dinâmico Embutido (Longo Prazo / Fases 3+)
**Status:** ⬜ A Fazer
A ser aplicado exclusivamente em dicionários hiper-granulares cujo limite estouraria a janela de contexto de um LLM convencional (Exemplos: milhares de árvores de CNAE em bases de CNPJ, CBO de salários).
- **Como funciona:** O acerto semântico é removido completamente do ombro da Inteligência Artificial. O usuário pede *"Dados climáticos para terra da garoa"*. O canal envia para a sua infraestrutura interna. Lá dentro do *MCP Server* (onde está o DuckDB), aplica-se um passo autônomo e imediato de banco vetorial ou busca semântica em RAM contra um Dicionário de Dados do Seade (latência < 50ms) sem depender da internet.
- **A Função Exata:** Ele detecta vetorialmente que "terra da garoa" = "São Paulo", substitui a _query string_ e a despacha validada para o LLM.
- **Vantagem:** Precisão absoluta sem degradar latência ou onerar o custo financeiro (*budget tokens*) da IA com repasses contínuos de milhares de sinônimos.

---

## 🐛 Cauda Longa e Bugs Conhecidos

As pendências rotineiras de manutenção e bugs em aberto que devem ser atacados antes do próximo deploy massivo em Produção.

### PEND-001 — Proteção da API Key do Gemini no Deploy
**Status: pendente — decidir antes do deploy**
A chave do Gemini está em `config.ts`. No deploy, o Vite a embute no bundle JavaScript — qualquer pessoa pode extraí-la inspecionando o código.
**Alternativas propostas:**
*   **Opção 1 (Simples):** No Google AI Studio, restringir a chave para funcionar apenas no domínio de deploy (Adequado para fase de testes).
*   **Opção 2 (Backend Proxy):** O frontend chama o backend, que chama o Gemini. (Adequado para adoção do MCP Centralizado Corporativo).

### BUG-001 — Filtros de setor e região retornam 0 no Chat (Problema de Encoding Latin-1 vs UTF-8)
**Status: Diagnóstico Concluído | Solução Pendente**
O CSV local (`piesp_confirmados_com_valor.csv`) está em _Latin-1_ e o sistema Vite injeta como _UTF-8_. No chat, o Gemini gera os nomes em português impecável ("Região Metropolitana"), que esbarram com os nomes distorcidos importados da base (Ex: `"RA S\uFFFDo Paulo"`). Isso faz as Tools retornarem 0 projetos na busca cruzada.
**Solução Definitiva Definida:** Executar pré-processamento via script node para converter a base CSV inteiramente para UTF-8 antes do Bundle do App. Não empilhar funções corretoras secundárias (workarounds).
