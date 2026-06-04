# Arquitetura Mobile

## Escopo

A versao mobile da Nadia Empreendedorismo oferece tres telas:

- `LandingPage`: entrada visual e botoes de acesso.
- `ChatView`: conversa por texto com consulta deterministica da base.
- `VoiceView`: conversa por voz com Gemini Live API.

Views desktop, dashboards generativos e exploracoes tabulares completas pertencem a versao web, nao a esta branch.

## Fluxo do Chat

```text
Usuario
  -> ChatView
  -> useChat
  -> Gemini generateContent
  -> consultar_empresas_empreendedorismo
  -> empreendedorismoDataService
  -> mcpService
  -> MCP remoto do Seade
```

O modelo escolhe filtros; o codigo executa a consulta. A resposta final e uma sintese textual baseada no JSON retornado.

## Fluxo de Voz

```text
Usuario fala
  -> VoiceView
  -> useLiveConnection
  -> Gemini Live API
  -> tool consultar_empresas_empreendedorismo
  -> MCP remoto do Seade
  -> resposta falada
```

O payload da ferramenta deve ser compacto para evitar instabilidade no WebSocket.

## Resiliencia

- Chat: Gemini direto com fallback OpenRouter quando configurado.
- Voz: Gemini Live API.
- MCP: proxy Vite em `/mcp-api`, redirecionando para `https://mcp.seade.gov.br/mcp`.

## Regra de Manutencao

Nao reintroduzir leitura local de CSV, Parquet ou banco WASM no browser. A base tabular fica fora do bundle e e acessada por MCP.
