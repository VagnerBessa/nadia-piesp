const MCP_SERVER_URL = 'https://mcp.seade.gov.br/mcp?key=sk_1070bd250a3c5a13b986d112454fa59ac0f6781185a7d543';
import fs from 'fs';

async function main() {
  const initRes = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
      id: 1
    })
  });
  
  const sessionId = initRes.headers.get('mcp-session-id');
  
  const toolsRes = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': sessionId || ''
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 2 })
  });
  
  const toolsData = await toolsRes.text();
  const dataLine = toolsData.split('\n').find(line => line.startsWith('data: '));
  if (dataLine) {
    const json = JSON.parse(dataLine.substring(6));
    fs.writeFileSync('mcp_tools.json', JSON.stringify(json.result.tools, null, 2));
    console.log("Tools written to mcp_tools.json");
  }
}
main().catch(console.error);
