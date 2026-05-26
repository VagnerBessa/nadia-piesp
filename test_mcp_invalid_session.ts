import { callMcpTool } from './services/mcpService.js';

async function test() {
  const originalFetch = global.fetch;
  global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    let urlStr = url.toString();
    if (urlStr.startsWith('/mcp-api')) {
      urlStr = 'http://localhost:3010' + urlStr;
    }
    
    // Força um session id inválido
    if (init?.headers) {
      const headers = new Headers(init.headers);
      if (headers.has('mcp-session-id')) {
        headers.set('mcp-session-id', 'invalid-session-id-123');
      }
      init.headers = headers;
    }
    
    const res = await originalFetch(urlStr, init);
    if (!res.ok) {
      console.log("Response not OK:", res.status, await res.text());
    }
    return res;
  };

  const res = await callMcpTool("agregar_dados", {
    dataset_id: "empresas-sp-mar26-20260522",
    agregacoes: [{ coluna: "cnpj", funcao: "CONTAGEM" }]
  });
  console.log("Result:", res);
}
test().catch(console.error);
