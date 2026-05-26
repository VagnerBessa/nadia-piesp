import { callMcpTool } from './services/mcpService.js';

async function test() {
  console.log("Calling MCP Tool via Proxy...");
  // Monkey-patch fetch to use the local dev server instead of relative path
  const originalFetch = global.fetch;
  global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    let urlStr = url.toString();
    if (urlStr.startsWith('/mcp-api')) {
      urlStr = 'http://localhost:3010' + urlStr;
    }
    console.log("Fetching:", urlStr);
    return originalFetch(urlStr, init);
  };

  const res = await callMcpTool("agregar_dados", {
    dataset_id: "empresas-sp-mar26-20260522",
    agregacoes: [{ coluna: "cnpj", funcao: "CONTAGEM" }]
  });
  console.log("Result:", res);
}
test().catch(console.error);
