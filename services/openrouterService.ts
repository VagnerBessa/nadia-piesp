/**
 * openrouterService.ts
 *
 * Fallback para quando o Google Gemini retorna 503/sobrecarga.
 * Usa a API do OpenRouter (formato OpenAI) com o mesmo modelo gemini-2.5-flash,
 * mas roteado pela infraestrutura do OpenRouter — frequentemente disponível
 * mesmo quando a API direta do Google está sobrecarregada.
 *
 * Documentação: https://openrouter.ai/docs
 */

import { OPENROUTER_API_KEY } from '../config';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FALLBACK_MODEL = 'google/gemini-2.0-flash-001';

// ─── Tipos OpenAI-compatíveis ───────────────────────────────────────────────

interface OAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface OAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ─── Conversão: histórico Gemini → mensagens OpenAI ────────────────────────

type GeminiPart = { text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: unknown } };
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

function geminiContentsToOAI(systemInstruction: string, contents: GeminiContent[]): OAIMessage[] {
  const messages: OAIMessage[] = [
    { role: 'system', content: systemInstruction }
  ];

  for (const item of contents) {
    const role = item.role === 'model' ? 'assistant' : 'user';

    for (const [partIdx, part] of item.parts.entries()) {
      if (part.text) {
        messages.push({ role, content: part.text });
      } else if (part.functionCall) {
        // Chamada de ferramenta do modelo — usa ID determinístico baseado na posição
        // para que a resposta (functionResponse) possa casar o ID.
        const callId = `call_${part.functionCall.name}_${partIdx}`;
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: callId,
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args)
            }
          }]
        });
      } else if (part.functionResponse) {
        // Resposta da ferramenta — busca o ID correspondente (mesma posição relativa)
        const callId = `call_${part.functionResponse.name}_${partIdx - 1}`;
        messages.push({
          role: 'tool',
          content: JSON.stringify(part.functionResponse.response),
          tool_call_id: callId,
          name: part.functionResponse.name
        });
      }
    }
  }

  return messages;
}

// ─── Conversão: piespTools (Gemini) → tools (OpenAI) ───────────────────────

type GeminiToolDecl = {
  functionDeclarations: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }[]
};

function geminiToolsToOAI(geminiTools: any[]): OAITool[] {
  const tools: OAITool[] = [];
  for (const group of geminiTools) {
    // Pula grupos de ferramentas que não são baseadas em funções (ex: googleSearch)
    if (!group.functionDeclarations) continue;
    
    for (const decl of group.functionDeclarations) {
      // Converte parâmetros Gemini (Type.STRING etc.) para JSON Schema puro
      const params = convertGeminiParams(decl.parameters);
      tools.push({
        type: 'function',
        function: {
          name: decl.name,
          description: decl.description,
          parameters: params
        }
      });
    }
  }
  return tools;
}

function convertGeminiParams(params: Record<string, unknown>): Record<string, unknown> {
  if (!params || typeof params !== 'object') return {};

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (key === 'type') {
      // Gemini usa Type.OBJECT (string "OBJECT"), OpenAI usa "object"
      result[key] = String(value).toLowerCase();
    } else if (key === 'properties' && typeof value === 'object') {
      const props: Record<string, unknown> = {};
      for (const [propKey, propVal] of Object.entries(value as Record<string, unknown>)) {
        props[propKey] = convertGeminiParams(propVal as Record<string, unknown>);
      }
      result[key] = props;
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ─── Chamada principal ──────────────────────────────────────────────────────

export interface OpenRouterResult {
  text: string;
}

export async function callOpenRouter(
  contents: GeminiContent[],
  systemInstruction: string,
  geminiTools: GeminiToolDecl[],
  executarFerramenta: (nome: string, args: Record<string, unknown>) => Promise<any>
): Promise<OpenRouterResult> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY não configurada em config.ts');
  }

  const tools = geminiToolsToOAI(geminiTools);
  let messages = geminiContentsToOAI(systemInstruction, contents);

  console.log(`🔀 [OpenRouter] Fallback ativado — modelo: ${FALLBACK_MODEL}`);

  const maxIterations = 5;
  for (let i = 0; i < maxIterations; i++) {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://seade.gov.br',
        'X-Title': 'Nadia PIESP'
      },
      body: JSON.stringify({
        model: FALLBACK_MODEL,
        messages,
        tools,
        tool_choice: 'auto'
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message: OAIMessage = choice?.message;

    if (!message) throw new Error('OpenRouter: resposta sem choices');

    // Sem tool calls — resposta final
    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.log(`✅ [OpenRouter] Resposta final recebida.`);
      return { text: message.content || 'Sem resposta.' };
    }

    // Executa as ferramentas localmente
    messages.push(message);

    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || '{}');
      console.log(`🛠️ [OpenRouter] Tool call: ${toolCall.function.name}`, args);

      const resultado = await executarFerramenta(toolCall.function.name, args);

      messages.push({
        role: 'tool',
        content: JSON.stringify(resultado),
        tool_call_id: toolCall.id,
        name: toolCall.function.name
      });
    }
  }

  throw new Error('OpenRouter: máximo de iterações de function calling atingido');
}
