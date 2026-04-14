# Arquitetura

Decisões e direções arquiteturais — implementadas e planejadas.

---

## Backend para Nadia

**Status: planejado**

Nadia hoje é puramente frontend — sem backend. Isso cria três problemas:

1. **API key do Gemini exposta** no bundle JavaScript
2. **CSV embutido no bundle** — dados duplicados (browser e MCP server)
3. **Não consegue chamar o MCP server** diretamente do browser

Um backend mínimo resolve os três simultaneamente:

```
Hoje
Browser → Gemini (API key exposta)
Browser → CSV local (?raw)

Com backend
Browser → Backend → Gemini (API key protegida)
Browser → Backend → MCP server (dados centralizados)
```

O backend seria um proxy simples — Firebase Function ou Google Cloud Run. Não é um sistema complexo.

**Efeito colateral:** com backend, o encoding do CSV é lido corretamente no servidor (Latin-1), eliminando o BUG-001 de filtros no Chat.

---

## MCP Server Centralizado

**Status: planejado**

Hoje existe duplicação de código:
- `piespDataService.ts` — usado pela Nadia no browser
- `mcp-server/src/piespService.ts` — cópia usada pelo MCP server (Hermes, Claude Desktop)

A direção correta é um MCP server externo como única fonte de verdade para os dados:

```
knowledge_base/ (CSVs)
       ↓
MCP Server determinístico
  (filtro, agregação, normalização)
       ↓
  ┌────┴────┐
Nadia    Hermes / Claude
Backend  (via MCP protocol)
(via REST)
```

**Quando faz sentido implementar:** quando Nadia ganhar backend. O backend chama o MCP via REST, Hermes usa o protocolo MCP. Mesmo servidor, duas interfaces.

### Múltiplas bases de dados

O MCP server pode crescer para servir outras bases além da PIESP:

```
mcp-server/src/
  piespService.ts        ← PIESP (já existe)
  empresasService.ts     ← futura base de empresas
  municipiosService.ts   ← futura base de municípios
  index.ts               ← expõe todas as tools
```

Um servidor, múltiplos serviços. Hermes e Nadia se conectam a um endpoint só.

### Onde hospedar

- **CSVs + MCP server:** Google Cloud Run (container, escala automática, mesmo ecossistema Google)
- **Alternativa:** servidor da própria Seade, se houver restrições sobre onde os dados podem ficar

---

## Nadia Mobile

**Status: em desenvolvimento — branch `mobile`**

Versão simplificada da Nadia com apenas Chat e Voz, design mobile-first.

**O que fica:** Landing, ChatView, VoiceView, todos os serviços por baixo.
**O que some:** Dashboards, Municípios, Explorar, Empresas, Data Lab, Upload.

**Deploy:** Firebase Hosting com duas URLs:
- `nadia-piesp.web.app` → versão completa (desktop)
- `nadia-mobile.web.app` → Nadia Mobile

Deploy via GitHub Actions — push na branch `mobile` dispara deploy automático para `nadia-mobile.web.app`.

**Segurança da API key:** restringir a chave por domínio no Google AI Studio. A chave só funciona nas URLs de deploy — extraí-la do bundle não serve para nada fora desses domínios.
