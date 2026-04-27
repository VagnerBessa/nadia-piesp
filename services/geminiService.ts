/**
 * geminiService.ts
 *
 * Wrapper de geração de texto com fallback automático para OpenRouter.
 * Usado pelas views que chamam Gemini diretamente (sem function calling):
 * ExplorarDadosView, PerfilEmpresaView, DataLabView.
 *
 * Fluxo:
 *  1. Tenta Gemini direto
 *  2. Se 503/sobrecarga e OPENROUTER_API_KEY configurada → tenta OpenRouter
 *  3. Se ambos falharem → lança o erro original do Gemini
 */

import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY, OPENROUTER_API_KEY } from '../config';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FALLBACK_MODEL = 'google/gemini-2.0-flash-001';

export interface GenerateOptions {
  prompt: string;
  systemInstruction?: string;
  thinkingBudget?: number;
  tools?: any[];
}

export interface GenerateResult {
  text: string;
  groundingChunks?: any[];
  groundingSupports?: any[];
}

function getGeminiError(e: any) {
  const status = e?.status ?? e?.statusCode ?? e?.code ?? 0;
  const msg = (e?.message || JSON.stringify(e) || '').toLowerCase();
  
  const isRetryable = 
    status === 503 || status === 429 || status === 500 ||
    msg.includes('503') || msg.includes('429') || msg.includes('500') ||
    msg.includes('unavailable') || msg.includes('overloaded') || 
    msg.includes('high demand') || msg.includes('quota') || 
    msg.includes('rate limit') || msg.includes('resource_exhausted') ||
    msg.includes('fetch failed');
    
  return { isRetryable, status, msg };
}

async function tryOpenRouter(options: GenerateOptions): Promise<GenerateResult> {
  const messages: any[] = [];
  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  }
  messages.push({ role: 'user', content: options.prompt });

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://seade.gov.br',
      'X-Title': 'Nadia PIESP',
    },
    body: JSON.stringify({ model: FALLBACK_MODEL, messages }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || 'Sem resposta.';
  return { text };
}

export async function generateWithFallback(options: GenerateOptions): Promise<GenerateResult> {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const config: any = { thinkingConfig: { thinkingBudget: options.thinkingBudget ?? 0 } };
  if (options.systemInstruction) config.systemInstruction = options.systemInstruction;
  if (options.tools) config.tools = options.tools;

  const contents: any[] = [{ role: 'user', parts: [{ text: options.prompt }] }];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config,
    });

    const groundingMeta = response.candidates?.[0]?.groundingMetadata;
    return {
      text: response.text || '',
      groundingChunks: groundingMeta?.groundingChunks,
      groundingSupports: groundingMeta?.groundingSupports,
    };

  } catch (e: any) {
    const { isRetryable: retryable } = getGeminiError(e);
    if (retryable && OPENROUTER_API_KEY) {
      try {
        console.warn('🔀 Gemini error detectado — ativando fallback OpenRouter...');
        return await tryOpenRouter(options);
      } catch (orError: any) {
        console.error('❌ OpenRouter também falhou:', orError?.message);
      }
    }
    throw e;
  }
}
