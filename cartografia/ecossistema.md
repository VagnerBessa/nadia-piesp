# Ecossistema Nadia + Hermes

**Data:** Abril de 2026
**Contexto:** Discussão arquitetural sobre como expandir o projeto Nadia para múltiplas bases de dados do Seade, integrando o Hermes Agent como camada de inteligência persistente.

---

## A arquitetura em três camadas

```
┌─────────────────────────────────────────────────────┐
│              CAMADA DE APRESENTAÇÃO                 │
│                                                     │
│  Nadia-PIESP    Nadia-Emprego    Nadia-Municipal    │
│  (web, rich UI) (web, rich UI)  (web, rich UI)     │
│  Gemini Flash   Gemini Flash    Gemini Flash        │
└────────────┬────────────┬────────────┬─────────────┘
             │            │            │
┌────────────▼────────────▼────────────▼─────────────┐
│                  CAMADA MCP                         │
│                                                     │
│   piesp-mcp      emprego-mcp     municipal-mcp      │
│   (pronto ✓)     (a construir)   (a construir)      │
└────────────┬────────────┬────────────┬─────────────┘
             │            │            │
             └────────────▼────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│                    HERMES AGENT                     │
│                                                     │
│  Conectado a todos os MCP servers                  │
│  Acessível via Telegram / Slack / WhatsApp          │
│  Memória persistente + skills que crescem           │
│  Respostas cruzadas entre domínios                 │
└─────────────────────────────────────────────────────┘
```

---

## Princípio de design

**Nadias = profundidade.** Cada Nadia é especializada num domínio, roda no browser, oferece UI rica (gráficos, dashboards, voz). Serve o analista que quer mergulhar num tema.

**Hermes = abrangência e continuidade.** Acessa todos os MCP servers simultaneamente, lembra de conversas anteriores, aprende padrões de uso. Serve o gestor que quer respostas rápidas no celular ou o pesquisador que precisa cruzar domínios.

**MCP servers = fonte de verdade.** Cada base de dados tem seu MCP server. Tanto as Nadias (via function calling do Gemini) quanto o Hermes (via protocolo MCP) leem da mesma fonte. Melhorias na camada de dados refletem nos dois sistemas.

---

## O que cada camada serve

| Perfil | Canal | Caso de uso |
|---|---|---|
| Analista do Seade | Nadia web app | Análise profunda com gráficos, dashboards, relatórios |
| Gestor / Secretaria | Hermes no Telegram | Pergunta rápida no celular |
| Pesquisador | Hermes | Correlacionar PIESP + emprego + demografia |
| Outro sistema | MCP direto | Integração programática |

---

## O que o Hermes acumula que as Nadias nunca terão

As Nadias são stateless — cada sessão começa do zero. O Hermes constrói conhecimento composto:

- Padrões de interesse por analista ("João sempre pergunta sobre Campinas e Sorocaba")
- Correlações entre domínios descobertas em sessões anteriores
- Skills procedurais criadas automaticamente a partir de boas respostas
- Histórico de análises para auditoria e referência futura

---

## Por que Hermes e não OpenClaw

OpenClaw (247k stars, criado em nov/2025) é fundamentalmente um **roteador de mensagens** — conecta plataformas de chat a modelos de IA, mas não aprende, não persiste conhecimento entre sessões.

Hermes Agent (NousResearch, v0.8.0 em abr/2026) é um **agente adaptativo com loop de aprendizagem embutido**. Cria skills a partir da experiência, mantém memória FTS5 entre sessões, suporta MCP nativo.

Critério decisivo para o Seade: a Cisco encontrou uma skill maliciosa no repositório do OpenClaw que fazia exfiltração de dados. Para uma fundação pública trabalhando com dados do estado de SP, esse risco de governança é inaceitável.

---

## Estado atual

- ✅ `mcp-server/` implementado — expõe 5 tools da PIESP via stdio e HTTP/SSE
- ⬜ Deploy do Hermes num servidor do Seade
- ⬜ Conexão Hermes ↔ piesp-mcp-server via SSE
- ⬜ Testes de queries cruzadas via Telegram
