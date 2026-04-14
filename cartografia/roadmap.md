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
