
import { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { SYSTEM_INSTRUCTION } from '../utils/prompts';
import { GEMINI_API_KEY } from '../config';
import { consultarEmpreendedorismoData, getMetadados } from '../services/empreendedorismoDataService';
import { buildSystemInstructionWithSkill, buildSystemInstructionWithSkillByName, detectSkill } from '../services/skillDetector';
import { callOpenRouter } from '../services/openrouterService';
import { OPENROUTER_API_KEY } from '../config';

export interface Source {
  uri: string;
  title: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: Source[];
}

// Tipo local para o histórico compatível com a API (inclui function call/response parts)
interface HistoryItem {
  role: 'user' | 'model';
  parts: { text?: string; functionCall?: any; functionResponse?: any }[];
}


const initialMessage: Message = {
    role: 'model',
    text: 'Olá! Sou a Nadia, assistente de IA da Fundação Seade. Posso consultar dados de empresas, aberturas, MEIs, setores, portes e municípios no Estado de São Paulo. O que gostaria de saber?'
};

// Cache lazy para os metadados e tools — carregados sob demanda
let _empreendedorismoToolsCache: any[] | null = null;

async function getEmpreendedorismoTools() {
  if (_empreendedorismoToolsCache) return _empreendedorismoToolsCache;

  const meta = await getMetadados();
  const regiaoDesc = meta.regioes.length > 0
    ? `Região administrativa do Estado de SP. Valores válidos: ${meta.regioes.join(', ')}. Usar quando o usuário perguntar por região, não por município específico.`
    : 'A região administrativa do Estado de SP, ex: "Região Metropolitana de São Paulo". Usar quando o usuário perguntar por região, não por município.';

  _empreendedorismoToolsCache = [
    {
      functionDeclarations: [
        {
          name: 'consultar_empresas_empreendedorismo',
          description: 'Use esta ferramenta sempre que o usuário perguntar sobre empresas, aberturas, fechamentos, empresas ativas, MEIs, porte, setor, natureza jurídica, rankings por município ou região no Estado de SP.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              ano: { type: Type.STRING, description: 'Ano exato de abertura, ex: 2026. Use quando o usuário pedir empresas abertas em um ano.' },
              ano_inicio: { type: Type.STRING, description: 'Ano inicial para intervalo de abertura.' },
              ano_fim: { type: Type.STRING, description: 'Ano final para intervalo de abertura.' },
              data_inicio: { type: Type.STRING, description: 'Data inicial YYYY-MM-DD para abertura de empresas.' },
              data_fim: { type: Type.STRING, description: 'Data final YYYY-MM-DD para abertura de empresas.' },
              municipio: { type: Type.STRING, description: 'O nome do município específico, se fornecido. Não usar para regiões administrativas.' },
              regiao: { type: Type.STRING, description: regiaoDesc },
              setor: { type: Type.STRING, description: 'Setor amplo: Agropecuária, Comércio, Indústria, Infraestrutura ou Serviços.' },
              termo_busca: { type: Type.STRING, description: 'Termo de atividade econômica específica, ex: tecnologia, software, saúde, restaurante, comércio varejista.' },
              porte: { type: Type.STRING, description: 'Porte cadastral: ME, EPP ou DEMAIS. Não use para MEI.' },
              opcao_mei: { type: Type.STRING, description: 'Use Sim para MEI, Não para não optante e Não se aplica quando o campo não se aplica.' },
              sexo: { type: Type.STRING, description: 'Homem ou Mulher. Use somente quando o usuário pedir perfil por sexo/gênero.' },
              natureza_juridica: { type: Type.STRING, description: 'Natureza jurídica. Para Inova Simples, use Empresa Simples de Inovação.' },
              situacao: { type: Type.STRING, description: 'Ativa ou Inativa. Use Ativa para total de empresas existentes; Inativa para fechadas/baixadas.' }
            }
          }
        }
      ]
    }
  ];
  return _empreendedorismoToolsCache;
}

// Ferramentas de pesquisa: Google Search para contexto externo
// (não pode ser combinado com functionDeclarations na mesma chamada)
const searchTools = [
  { googleSearch: {} }
];

// Executa a ferramenta de Empreendedorismo via MCP.
async function executarFerramenta(nome: string, args: any): Promise<any> {
  if (nome === 'consultar_empresas_empreendedorismo') {
    const resultados = await consultarEmpreendedorismoData(args);
    return { sucesso: true, ...resultados };
  }
  return { error: 'Ferramenta não reconhecida' };
}

interface UseChatOptions {
  selectedSkillName?: string | null;
}

// Retry com backoff para erros 503 — tenta até maxRetries vezes com pausa crescente
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, baseDelayMs = 2000): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      const msg = (e?.message || '').toLowerCase();
      const isRetryable = msg.includes('503') || msg.includes('unavailable') || msg.includes('overloaded') || msg.includes('high demand') || msg.includes('incomplete json') || msg.includes('load failed');
      if (!isRetryable || attempt === maxRetries) throw e;
      const delay = baseDelayMs * (attempt + 1); // 2s, 4s
      console.warn(`⏳ Gemini 503 — tentativa ${attempt + 1}/${maxRetries}. Aguardando ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw lastError;
}

export const useChat = ({ selectedSkillName }: UseChatOptions = {}) => {
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streamingComplete, setStreamingComplete] = useState(false);

  const historyRef = useRef<HistoryItem[]>([
    { role: 'model', parts: [{ text: initialMessage.text }] }
  ]);

  const sendMessage = async (text: string) => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setStreamingText(null);
    setStreamingComplete(false);

    // Atualização otimista da UI com a mensagem do usuário
    const userMessage: Message = { role: 'user', text };
    setMessages(prev => [...prev, userMessage]);

    // Variáveis declaradas fora do try para serem acessíveis no catch (fallback OpenRouter)
    const contents: HistoryItem[] = [
      ...historyRef.current,
      { role: 'user', parts: [{ text: text }] }
    ];

    const systemInstructionWithSkill = selectedSkillName
      ? buildSystemInstructionWithSkillByName(SYSTEM_INSTRUCTION, selectedSkillName)
      : buildSystemInstructionWithSkill(SYSTEM_INSTRUCTION, text);

    const detectedSkill = selectedSkillName ? null : detectSkill(text);
    const usarPesquisa = detectedSkill?.name === 'inteligencia_empresarial';
    const empreendedorismoTools = await getEmpreendedorismoTools();
    const ferramentasAtivas = usarPesquisa ? searchTools : empreendedorismoTools;

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      const modelName = 'gemini-2.5-flash';
      const thinkingConfig = { thinkingConfig: { thinkingBudget: 0 } };

      if (selectedSkillName) {
        console.log(`🎯 [Agente manual] Skill "${selectedSkillName}" injetada. System instruction: ${systemInstructionWithSkill.length} chars.`);
      } else {
        const autoSkill = detectSkill(text);
        if (autoSkill) {
          console.log(`🎯 [Agente auto] Skill "${autoSkill.label}" detectada por keywords. System instruction: ${systemInstructionWithSkill.length} chars.`);
        } else {
          console.log(`ℹ️ [Sem agente] Nenhuma skill ativa. System instruction: ${systemInstructionWithSkill.length} chars.`);
        }
      }

      // Loop de function calling com streaming na resposta final.
      // Itera até 4 vezes; function calls usam generateContent (necessário para detectar o call
      // antes de executar a ferramenta). A última chamada (texto final) usa generateContentStream.
      let currentContents: HistoryItem[] = [...contents];
      let finalText = '';
      let finalSources: Source[] = [];

      for (let iteration = 0; iteration < 4; iteration++) {
        const iterResult = await withRetry(async () => {
          setStreamingText(null); // limpa em caso de retry
          const fcalls: any[] = [];
          let iterText = '';
          let lastChunk: any = null;

          const stream = await (ai.models as any).generateContentStream({
            model: modelName,
            contents: currentContents,
            config: {
              systemInstruction: systemInstructionWithSkill,
              tools: ferramentasAtivas,
              ...thinkingConfig
            }
          });

          for await (const chunk of stream) {
            lastChunk = chunk;
            const parts = chunk.candidates?.[0]?.content?.parts || [];

            let hasFunctionCall = false;
            for (const part of parts) {
              if (part.functionCall) {
                fcalls.push(part.functionCall);
                hasFunctionCall = true;
              }
            }

            if (hasFunctionCall) {
              // Resposta com tool call — descarta qualquer texto de preamble
              iterText = '';
              setStreamingText(null);
            } else {
              const delta: string = chunk.text || '';
              if (delta) {
                iterText += delta;
                setStreamingText(prev => (prev || '') + delta);
              }
            }
          }

          return { fcalls, text: iterText, lastChunk };
        });

        if (iterResult.fcalls.length === 0) {
          // Resposta final em texto
          finalText = iterResult.text || "Não encontrei uma resposta para sua pergunta.";

          const groundingChunks = iterResult.lastChunk?.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (groundingChunks) {
            const webSources = groundingChunks
              .map((c: any) => c.web)
              .filter((w: any) => w?.uri && w?.title)
              .map((w: any) => ({ uri: w.uri, title: w.title }));
            finalSources = webSources.filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.uri === v.uri) === i);
          }
          break;
        }

        // Tem function calls — executa e acumula no histórico
        setStreamingText(null);
        for (const fc of iterResult.fcalls) {
          const resultado = await executarFerramenta(fc.name!, fc.args || {});
          currentContents = [
            ...currentContents,
            { role: 'model' as const, parts: [{ functionCall: { name: fc.name!, args: fc.args || {} } }] },
            { role: 'user' as const, parts: [{ functionResponse: { name: fc.name!, response: resultado } }] }
          ];
        }
      }

      const modelMessage: Message = {
        role: 'model',
        text: finalText || "Não encontrei uma resposta para sua pergunta.",
        sources: finalSources.length > 0 ? finalSources : undefined
      };

      // Atualiza o histórico para a próxima interação
      historyRef.current = [...contents, { role: 'model', parts: [{ text: finalText }] }];

      // Sinaliza conclusão — streamingText mantém o valor acumulado para o drain drenar
      setStreamingComplete(true);
      setMessages(prev => [...prev, modelMessage]);

    } catch (e: any) {
      setStreamingText(null);
      const rawMsg = (e?.message || JSON.stringify(e) || '').toLowerCase();
      console.error('❌ Chat error — raw:', e?.message || e);

      const is503 = rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('unavailable') || rawMsg.includes('overloaded');
      const isApiKeyError = rawMsg.includes('api_key') || rawMsg.includes('api key') || rawMsg.includes('invalid') || rawMsg.includes('401') || rawMsg.includes('403');

      // Fallback OpenRouter: tenta quando Gemini retorna 503 ou erro de chave de API
      if ((is503 || isApiKeyError) && OPENROUTER_API_KEY) {
        console.warn('🔀 Gemini 503 persistente — ativando fallback OpenRouter...');
        try {
          const result = await callOpenRouter(
            contents,
            systemInstructionWithSkill,
            ferramentasAtivas as any,
            executarFerramenta
          );
          const modelMessage: Message = { role: 'model', text: result.text };
          historyRef.current = [...contents, { role: 'model', parts: [{ text: result.text }] }];
          setMessages(prev => [...prev, modelMessage]);
          return; // sucesso via fallback — não exibe erro
        } catch (orError: any) {
          console.error('❌ OpenRouter fallback também falhou:', orError?.message || orError);
          // Continua para exibir mensagem de erro abaixo
        }
      }

      let errorMessage: string;

      if (rawMsg.includes('429') || rawMsg.includes('quota') || rawMsg.includes('rate limit') || rawMsg.includes('resource_exhausted')) {
        errorMessage = '⚠️ Limite de requisições atingido (quota da API Gemini). Aguarde alguns segundos e tente novamente.';
      } else if (is503) {
        errorMessage = '⚠️ Os servidores do Google Gemini estão sobrecarregados no momento. Aguarde alguns segundos e tente novamente.';
      } else if (rawMsg.includes('500')) {
        errorMessage = '⚠️ Erro interno nos servidores do Google Gemini. Tente novamente.';
      } else if (rawMsg.includes('api_key') || rawMsg.includes('api key') || rawMsg.includes('invalid') || rawMsg.includes('401') || rawMsg.includes('403')) {
        errorMessage = '⚠️ Problema com a chave de API. Verifique as configurações.';
      } else {
        // Erro inesperado — mostra a mensagem real no console e um genérico na UI
        console.error('❌ Erro não categorizado:', rawMsg);
        errorMessage = `⚠️ Erro inesperado: ${e?.message?.substring(0, 120) || 'desconhecido'}. Verifique o console para detalhes.`;
      }

      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return { messages, sendMessage, isLoading, error, streamingText, streamingComplete };
};
