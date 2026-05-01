
import { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { SYSTEM_INSTRUCTION } from '../utils/prompts';
import { GEMINI_API_KEY } from '../config';
import { consultarPiespData, consultarAnunciosSemValor, getMetadados } from '../services/piespDataService';
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

export type ResponseMode = 'fast' | 'complete';

const initialMessage: Message = {
    role: 'model',
    text: 'Olá! Sou a Nadia, assistente de IA da Fundação Seade. Posso consultar o banco de dados de investimentos confirmados no Estado de São Paulo (PIESP), incluindo uma base secundária de anúncios sem valores divulgados. O que gostaria de saber?'
};

// Cache lazy para os metadados e tools — carregados sob demanda
let _piespToolsCache: any[] | null = null;

async function getPiespTools() {
  if (_piespToolsCache) return _piespToolsCache;

  const meta = await getMetadados();
  const regiaoDesc = meta.regioes.length > 0
    ? `Região administrativa do Estado de SP. Valores válidos: ${meta.regioes.join(', ')}. Usar quando o usuário perguntar por região, não por município específico.`
    : 'A região administrativa do Estado de SP, ex: "Região Metropolitana de São Paulo". Usar quando o usuário perguntar por região, não por município.';

  _piespToolsCache = [
    {
      functionDeclarations: [
        {
          name: 'consultar_projetos_piesp',
          description: 'Usa esta ferramenta SEMPRE que o usuário perguntar sobre números, soma, listar ou consultar investimentos com valor divulgado do estado de SP (PIESP). Para filtrar por setor (Indústria, Infraestrutura etc.), use o parâmetro `setor`. Retorna os principais projetos confirmados com montante financeiro.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              ano: { type: Type.STRING, description: 'Ano EXATO. Use SOMENTE quando o usuário pede especificamente "em [ano]" ou "no ano [ano]". NUNCA use para expressões de período: "depois de", "após", "desde", "a partir de", "entre", "últimos N anos", "recentes". Nesses casos OMITA este campo completamente — a ferramenta retorna todos os anos disponíveis.' },
              municipio: { type: Type.STRING, description: 'O nome do município específico, se fornecido. Não usar para regiões administrativas.' },
              regiao: { type: Type.STRING, description: regiaoDesc },
              setor: { type: Type.STRING, description: 'Setor econômico GERAL. Valores válidos EXATOS: "Agropecuária", "Comércio", "Indústria", "Infraestrutura", "Serviços". ATENÇÃO: atividades específicas como saúde, educação, tecnologia, farmácia, hospital NÃO são setores — use termo_busca para essas buscas.' },
              termo_busca: { type: Type.STRING, description: 'Busca por atividade econômica específica em múltiplos campos, incluindo CNAE. Use para: "saúde", "hospital", "farmácia", "educação", "tecnologia", "energia solar", "data center", "veículo elétrico" etc. PREFIRA este campo quando o usuário mencionar uma atividade que não é um dos 5 setores gerais.' }
            }
          }
        },
        {
          name: 'consultar_anuncios_sem_valor',
          description: 'Consulta a base secundária de anúncios de investimento sem valor financeiro divulgado. Chame SEMPRE em conjunto com consultar_projetos_piesp quando o usuário pedir uma descrição ampla de investimentos por região, setor ou município — para ter a visão completa do PIESP. Omita apenas se o usuário estiver claramente focado só em valores e somas. REGRA CRÍTICA: Se o usuário mencionar um tipo específico de empresa (hospital, farmácia, montadora, data center, escola, etc.), OBRIGATORIAMENTE passe esse tipo como `termo_busca`. Sem esse filtro, a ferramenta retorna 2000+ registros mistos e os resultados não representarão o tipo solicitado.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              ano: { type: Type.STRING, description: 'Ano EXATO. OMITA para "depois de", "após", "desde", "a partir de", "entre", "período".' },
              municipio: { type: Type.STRING, description: 'O nome do município, se fornecido' },
              regiao: { type: Type.STRING, description: regiaoDesc },
              setor: { type: Type.STRING, description: 'Setor econômico GERAL. Valores válidos EXATOS: "Agropecuária", "Comércio", "Indústria", "Infraestrutura", "Serviços". Para atividades específicas (saúde, educação, farmácia etc.) use termo_busca.' },
              termo_busca: { type: Type.STRING, description: 'Busca por atividade econômica específica em múltiplos campos incluindo CNAE. Use para: "saúde", "hospital", "farmácia", "educação", "tecnologia" etc.' }
            }
          }
        }
      ]
    }
  ];
  return _piespToolsCache;
}

// Ferramentas de pesquisa: Google Search para contexto externo
// (não pode ser combinado com functionDeclarations na mesma chamada)
const searchTools = [
  { googleSearch: {} }
];

// Executa a ferramenta localmente e retorna o resultado (async — DuckDB queries)
async function executarFerramenta(nome: string, args: any): Promise<any> {
  if (nome === 'consultar_projetos_piesp') {
    let resultados = await consultarPiespData({ ano: args.ano, municipio: args.municipio, regiao: args.regiao, setor: args.setor, termo_busca: args.termo_busca });
    // Se retornou 0 com filtro de ano, tenta sem — o modelo pode ter adicionado
    // um ano específico para uma consulta de período ("depois de 2020", "desde 2021")
    if (resultados.total_projetos === 0 && args.ano) {
      const semAno = await consultarPiespData({ municipio: args.municipio, regiao: args.regiao, setor: args.setor, termo_busca: args.termo_busca });
      if (semAno.total_projetos > 0) resultados = semAno;
    }
    return { sucesso: true, ...resultados };
  }
  if (nome === 'consultar_anuncios_sem_valor') {
    let resultados = await consultarAnunciosSemValor({ ano: args.ano, municipio: args.municipio, regiao: args.regiao, setor: args.setor, termo_busca: args.termo_busca });
    if (resultados.total_anuncios === 0 && args.ano) {
      const semAno = await consultarAnunciosSemValor({ municipio: args.municipio, regiao: args.regiao, setor: args.setor, termo_busca: args.termo_busca });
      if (semAno.total_anuncios > 0) resultados = semAno;
    }
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

  const sendMessage = async (text: string, mode: ResponseMode = 'complete') => {
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
    const piespTools = await getPiespTools();
    const ferramentasAtivas = usarPesquisa ? searchTools : piespTools;

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      const modelName = 'gemini-2.5-flash';
      const thinkingConfig = mode === 'complete'
        ? { thinkingConfig: { thinkingBudget: 512 } }
        : { thinkingConfig: { thinkingBudget: 0 } };

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

      // Fallback OpenRouter: tenta quando Gemini retorna 503 e a chave está configurada
      if (is503 && OPENROUTER_API_KEY) {
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