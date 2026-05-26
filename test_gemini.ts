import { GoogleGenAI } from '@google/genai';
import { SYSTEM_INSTRUCTION } from './utils/prompts.js';
import { empreendedorismoTools } from './generated_tools.js';

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });
async function test() {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: "qual o número de empresas no Estado?",
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: empreendedorismoTools as any,
      temperature: 0.7
    }
  });
  console.log("AI Response function calls:", JSON.stringify(response.functionCalls, null, 2));
}
test().catch(console.error);
