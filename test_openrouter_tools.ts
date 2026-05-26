import { OPENROUTER_API_KEY } from './config.js';
import { empreendedorismoTools } from './generated_tools.js';

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
  const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
  const tools = geminiToolsToOAI(empreendedorismoTools);
  
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VITE_OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://seade.gov.br',
      'X-Title': 'Nadia PIESP'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'Qual o número de empresas?' }],
      tools: tools,
      tool_choice: 'auto'
    })
  });
  
  if (!response.ok) {
    console.error("OpenRouter Error:", await response.text());
  } else {
    console.log("OpenRouter Success!");
  }
}
test().catch(console.error);
