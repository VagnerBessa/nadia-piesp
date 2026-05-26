import { OPENROUTER_API_KEY } from './config.js';
import { empreendedorismoTools } from './generated_tools.js';
import { callMcpTool } from './services/mcpService.js';

function convertGeminiParams(params: any): any {
  if (!params || typeof params !== 'object') return {};
  const result: any = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === 'type') {
      result[key] = String(value).toLowerCase();
    } else if (key === 'properties' && typeof value === 'object') {
      const props: any = {};
      for (const [propKey, propVal] of Object.entries(value as any)) {
        props[propKey] = convertGeminiParams(propVal);
      }
      result[key] = props;
    } else if (key === 'items' && typeof value === 'object') {
      result[key] = convertGeminiParams(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function geminiToolsToOAI(geminiTools: any[]) {
  const tools: any[] = [];
  for (const group of geminiTools) {
    if (!group.functionDeclarations) continue;
    for (const decl of group.functionDeclarations) {
      tools.push({
        type: 'function',
        function: {
          name: decl.name,
          description: decl.description,
          parameters: convertGeminiParams(decl.parameters)
        }
      });
    }
  }
  return tools;
}

async function test() {
  // Mock fetch para MCP
  const originalFetch = global.fetch;
  global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    let urlStr = url.toString();
    if (urlStr.startsWith('/mcp-api')) {
      urlStr = 'http://localhost:3010' + urlStr;
    }
    return originalFetch(urlStr, init);
  };

  const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
  const tools = geminiToolsToOAI(empreendedorismoTools);
  
  let messages: any[] = [
    { role: 'system', content: 'Use the dataset empresas-sp-mar26-20260522 e a coluna cnpj' },
    { role: 'user', content: 'Qual o número de empresas?' }
  ];

  for (let i=0; i<3; i++) {
    const response = await originalFetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://seade.gov.br',
        'X-Title': 'Nadia PIESP'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: messages,
        tools: tools,
        tool_choice: 'auto'
      })
    });
    
    const json = await response.json();
    const msg = json.choices[0].message;
    console.log("OpenRouter said:", JSON.stringify(msg, null, 2));

    if (!msg.tool_calls) {
      break;
    }

    messages.push(msg);

    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments);
      console.log("Calling MCP Tool:", call.function.name, args);
      const res = await callMcpTool(call.function.name, args);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(res)
      });
    }
  }
}
test().catch(console.error);
