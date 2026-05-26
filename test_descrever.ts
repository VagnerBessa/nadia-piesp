import { callMcpTool } from './services/mcpService.js';

async function test() {
  const originalFetch = global.fetch;
  global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    let urlStr = url.toString();
    if (urlStr.startsWith('/mcp-api')) {
      urlStr = 'http://localhost:3010' + urlStr;
    }
    return originalFetch(urlStr, init);
  };

  const res = await callMcpTool("descrever_dataset", {
    dataset_id: "empresas-sp-mar26-20260522"
  });
  console.log("Result:", JSON.stringify(res, null, 2));
}
test().catch(console.error);
