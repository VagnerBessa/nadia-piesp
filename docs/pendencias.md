# Pendências

Decisões técnicas ainda não implementadas, com alternativas documentadas.

---

## PEND-001 — Proteção da API Key do Gemini

**Status: pendente — decidir antes do deploy**

A chave do Gemini está em `config.ts` (gitignored localmente). No deploy, o Vite a embute no bundle JavaScript — qualquer pessoa pode extraí-la inspecionando o código.

### Alternativas em ordem de complexidade

**Opção 1 — Restrição por domínio (sem código, 5 min)**
No Google AI Studio, restringir a chave para funcionar apenas no domínio de deploy (ex: `nadia-piesp.web.app`). A chave continua no bundle, mas é inútil fora desse domínio. Adequado para uso interno com pessoas de confiança.

**Opção 2 — Variável de ambiente Vite (mudança mínima no código)**
Mover a chave para `.env` (`VITE_GEMINI_API_KEY`). O Vite substitui em tempo de build — a chave ainda vai para o bundle, mas sai do `config.ts` e pode ser gerenciada como secret no CI/CD. Não requer backend.

**Opção 3 — Backend proxy (proteção real)**
A chave fica no servidor, nunca no bundle. O frontend chama o backend, que chama o Gemini. Requer criar um backend (Firebase Function ou Cloud Run). Ver `docs/arquitetura.md`.

### Recomendação

Para uso interno com poucas pessoas de confiança: **Opção 1** resolve com zero código.
Para deploy mais amplo ou formal: **Opção 3** é a correta — mas depende de ter o backend pronto.
