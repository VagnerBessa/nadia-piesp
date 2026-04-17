# Integração MCP (Model Context Protocol)

## 📋 Visão Geral

A Nadia agora possui integração com um servidor MCP (Model Context Protocol) para buscar informações especializadas sobre tópicos específicos, começando com **papel e celulose**.

## 🚀 Como Funciona

### Detecção Automática de Tópicos

Quando um usuário faz uma pergunta que contém palavras-chave relacionadas a papel e celulose, o sistema:

1. **Detecta o tópico** através de palavras-chave como:
   - papel
   - celulose
   - papelão
   - papel e celulose
   - indústria papeleira
   - produção de papel
   - fabricação de papel
   - setor de papel
   - papel kraft
   - papel reciclado

2. **Consulta o servidor MCP** em `http://localhost:5678/mcp-server/http`

3. **Enriquece o contexto** da resposta da IA com os dados retornados pelo MCP

4. **Gera uma resposta completa** usando tanto o conhecimento da IA quanto os dados do MCP

### Fluxo de Dados

```
Usuário faz pergunta
    ↓
Detecção de palavras-chave (services/mcpService.ts)
    ↓
Gatilho detectado? → SIM
    ↓
Requisição HTTP ao MCP Server
    ↓
Dados recebidos do MCP
    ↓
Contexto enriquecido enviado ao Gemini
    ↓
Resposta gerada com dados do MCP
    ↓
Exibição ao usuário
```

## 🛠️ Configuração

### Pré-requisitos

1. Servidor MCP rodando em `http://localhost:5678/mcp-server/http`
2. O servidor deve aceitar requisições POST com o formato:

```json
{
  "method": "GET",
  "url": "/search?q=<query>&topic=papel-celulose",
  "headers": {
    "Accept": "application/json"
  }
}
```

### Personalização

#### Modificar a URL do MCP

Edite [services/mcpService.ts:8](services/mcpService.ts#L8):

```typescript
const MCP_SERVER_URL = 'http://localhost:5678/mcp-server/http';
```

#### Adicionar Novas Palavras-chave

Edite [services/mcpService.ts:52-63](services/mcpService.ts#L52-L63):

```typescript
const keywords = [
  'papel',
  'celulose',
  // Adicione suas palavras-chave aqui
  'nova-palavra',
];
```

#### Customizar a Requisição MCP

Edite [services/mcpService.ts:73-80](services/mcpService.ts#L73-L80):

```typescript
export async function fetchPapelCeluloseData(query: string): Promise<McpResponse> {
  return mcpHttpRequest({
    method: 'GET',
    url: `/sua-rota?q=${encodeURIComponent(query)}`,
    headers: {
      'Authorization': 'Bearer seu-token', // Se necessário
      'Accept': 'application/json',
    },
  });
}
```

## 📁 Arquivos Modificados

1. **[services/mcpService.ts](services/mcpService.ts)** - Novo serviço de integração MCP
2. **[hooks/useChat.ts](hooks/useChat.ts)** - Hook de chat modificado para usar MCP

## 🧪 Testando

1. Inicie seu servidor MCP em `http://localhost:5678/mcp-server/http`

2. Inicie a aplicação Nadia:
   ```bash
   npm run dev
   ```

3. Abra o chat e faça perguntas sobre papel e celulose:
   - "Me fale sobre a indústria de papel e celulose"
   - "Qual a produção de celulose no Brasil?"
   - "Como funciona a fabricação de papel?"

4. Verifique o console do navegador para mensagens de debug:
   - `🔍 Detectado tópico de papel e celulose. Consultando MCP...`
   - `✅ Dados do MCP recebidos: {...}`
   - `⚠️ Erro ao buscar dados do MCP: ...`

## 🔧 Solução de Problemas

### MCP não está sendo consultado

- Verifique se o servidor MCP está rodando
- Verifique o console do navegador para mensagens de erro
- Confirme que as palavras-chave estão presentes na pergunta

### Erro CORS

Se você receber erros de CORS, configure o servidor MCP para aceitar requisições de `http://localhost:3002` (ou a porta onde a Nadia está rodando):

```javascript
// Exemplo Node.js/Express
app.use(cors({
  origin: 'http://localhost:3002'
}));
```

### Dados do MCP não aparecem na resposta

- Verifique o formato da resposta do servidor MCP
- Confirme que `mcpResponse.success === true`
- Verifique os logs no console

## 🔮 Próximos Passos

- [ ] Adicionar mais tópicos especializados
- [ ] Implementar cache de respostas MCP
- [ ] Adicionar indicador visual quando MCP está sendo consultado
- [ ] Permitir que o usuário ative/desative a integração MCP
- [ ] Adicionar timeout para requisições MCP
- [ ] Implementar retry logic para falhas de rede

## 📚 Referências

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
