
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

// Tipo local para o histórico compatível com a API
interface HistoryItem {
  role: 'user' | 'model';
  parts: any[];
}

export type ResponseMode = 'fast' | 'complete';

const initialMessage: Message = {
    role: 'model',
    text: 'Olá! Sou a Nadia, assistente de IA da Fundação Seade. Posso consultar o banco de dados de investimentos confirmados no Estado de São Paulo (PIESP), incluindo uma base secundária de anúncios sem valores divulgados. O que gostaria de saber?'
};

// A descrição da região agora é estática porque os metadados são carregados de forma assíncrona.
const regiaoDesc = 'A região administrativa do Estado de SP, ex: "Região Metropolitana de São Paulo" ou "Campinas". Usar quando o usuário perguntar por região, não por município específico.';

const piespTools = [
  {
    functionDeclarations: [
      {
        name: 'consultar_projetos_piesp',
        description: 'Usa esta ferramenta SEMPRE que o usuário perguntar sobre números, soma, listar ou consultar investimentos com valor divulgado do estado de SP (PIESP). Para filtrar por setor (Indústria, Infraestrutura etc.), use o parâmetro `setor`. Retorna os principais projetos confirmados com montante financeiro.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            ano: { type: Type.STRING, description: 'Ano de anúncio/registro. Use SOMENTE quando o usuário pede especificamente "em [ano]" ou "no ano [ano]". NUNCA use para expressões de período de execução. Nesses casos OMITA este campo completamente e use ano_inicio/ano_fim.' },
            ano_inicio: { type: Type.STRING, description: 'Ano de início do período de execução do investimento (ex: "2026"). Use para buscas por período ("investimentos previstos entre X e Y", "começando em X").' },
            ano_fim: { type: Type.STRING, description: 'Ano de fim do período de execução do investimento (ex: "2030"). Use para buscas por período ("investimentos previstos até Y").' },
            municipio: { type: Type.STRING, description: 'O nome do município específico, se fornecido. Não usar para regiões administrativas.' },
            regiao: { type: Type.STRING, description: regiaoDesc },
            setor: { type: Type.STRING, description: 'Macro-setor econômico. Valores válidos EXATOS: "Agropecuária", "Comércio", "Indústria", "Infraestrutura", "Serviços". NUNCA invente variações. Se for um sub-setor (ex: "saúde", "tecnologia"), deixe isso vazio e use termo_busca.' },
            termo_busca: { type: Type.STRING, description: 'Termo livre para buscar na descrição, CNAE ou sub-setor (ex: "saúde", "tecnologia", "carro elétrico"). Use isso sempre que o usuário referir-se a uma área de negócio que não seja um dos 5 macro-setores.' }
          }
        }
      },
      {
        name: 'consultar_anuncios_sem_valor',
        description: 'Consulta a base secundária de anúncios de investimento sem valor financeiro divulgado. Chame SEMPRE em conjunto com consultar_projetos_piesp quando o usuário pedir uma descrição ampla de investimentos por região, setor ou município — para ter a visão completa do PIESP. Omita apenas se o usuário estiver claramente focado só em valores e somas.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            ano: { type: Type.STRING, description: 'Ano EXATO. OMITA para "depois de", "após", "desde", "a partir de", "entre", "período".' },
            ano_inicio: { type: Type.STRING, description: 'Ano de início da execução do investimento (ex: "2026").' },
            ano_fim: { type: Type.STRING, description: 'Ano de término da execução do investimento (ex: "2030").' },
            municipio: { type: Type.STRING, description: 'O nome do município, se fornecido' },
            regiao: { type: Type.STRING, description: regiaoDesc },
            setor: { type: Type.STRING, description: 'Macro-setor econômico. Valores válidos EXATOS: "Agropecuária", "Comércio", "Indústria", "Infraestrutura", "Serviços". NUNCA invente variações. Se for um sub-setor (ex: "saúde", "tecnologia"), deixe isso vazio e use termo_busca.' },
            termo_busca: { type: Type.STRING, description: 'Termo livre para buscar na descrição, CNAE ou sub-setor (ex: "saúde", "tecnologia", "carro elétrico"). Use isso sempre que o usuário referir-se a uma área de negócio que não seja um dos 5 macro-setores.' }
          }
        }
      }
    ]
  }
];

// Ferramentas de pesquisa: Google Search para contexto externo
// (não pode ser combinado com functionDeclarations na mesma chamada)
const searchTools = [
  { googleSearch: {} }
];

// Executa a ferramenta localmente e retorna o resultado
async function executarFerramenta(nome: string, args: any): Promise<any> {
  if (nome === 'consultar_projetos_piesp') {
    let resultados = await consultarPiespData({ ano: args.ano, ano_inicio: args.ano_inicio, ano_fim: args.ano_fim, municipio: args.municipio, regiao: args.regiao, setor: args.setor, termo_busca: args.termo_busca });
    // Se retornou 0 com filtro de ano, tenta sem — o modelo pode ter adicionado
    // um ano específico para uma consulta de período ("depois de 2020", "desde 2021")
    if (resultados.metadados.total_projetos === 0 && args.ano) {
      const semAno = await consultarPiespData({ ano_inicio: args.ano_inicio, ano_fim: args.ano_fim, municipio: args.municipio, regiao: args.regiao, setor: args.setor, termo_busca: args.termo_busca });
      if (semAno.metadados.total_projetos > 0) resultados = semAno;
    }
    return { sucesso: true, total_investimentos: resultados.metadados.total_investimento_milhoes, projetos: resultados.investimentos };
  }
  if (nome === 'consultar_anuncios_sem_valor') {
    let resultados = await consultarAnunciosSemValor({ ano: args.ano, ano_inicio: args.ano_inicio, ano_fim: args.ano_fim, municipio: args.municipio, regiao: args.regiao, setor: args.setor, termo_busca: args.termo_busca });
    if (resultados.length === 0 && args.ano) {
      const semAno = await consultarAnunciosSemValor({ ano_inicio: args.ano_inicio, ano_fim: args.ano_fim, municipio: args.municipio, regiao: args.regiao, setor: args.setor, termo_busca: args.termo_busca });
      if (semAno.length > 0) resultados = semAno;
    }
    return { sucesso: true, total_projetos: resultados.length, projetos: resultados };
  }
  return { error: 'Ferramenta não reconhecida' };
}

interface UseChatOptions {
  selectedSkillName?: string | null;
}

// Extrai o código de erro ou status da exceção do Gemini
function getGeminiError(e: any) {
  const status = e?.status ?? e?.statusCode ?? e?.code ?? 0;
  const msg = (e?.message || JSON.stringify(e) || '').toLowerCase();
  
  const is503 = status === 503 || msg.includes('503') || msg.includes('unavailable') || msg.includes('overloaded') || msg.includes('high demand') || msg.includes('fetch failed');
  const is429 = status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted');
  const is500 = status === 500 || msg.includes('500') || msg.includes('internal');
  
  return { status, msg, is503, is429, is500 };
}

// Retry com backoff para erros temporários — tenta até maxRetries vezes com pausa crescente
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, baseDelayMs = 2000): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      const { is503, is429, is500 } = getGeminiError(e);
      const isRetryable = is503 || is429 || is500;
      
      if (!isRetryable || attempt === maxRetries) throw e;
      
      const delay = baseDelayMs * (attempt + 1); // 2s, 4s
      console.warn(`⏳ Gemini Error — tentativa ${attempt + 1}/${maxRetries}. Aguardando ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw lastError;
}

export const useChat = ({ selectedSkillName }: UseChatOptions = {}) => {
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const historyRef = useRef<HistoryItem[]>([
    { role: 'model', parts: [{ text: initialMessage.text }] }
  ]);

  const sendMessage = async (text: string, mode: ResponseMode = 'complete') => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    
    // Atualização otimista da UI com a mensagem do usuário
    const userMessage: Message = { role: 'user', text };
    setMessages(prev => [...prev, userMessage]);

    // Variáveis declaradas fora do try para serem acessíveis no catch (fallback OpenRouter)
    let currentContents: HistoryItem[] = [
      ...historyRef.current,
      { role: 'user', parts: [{ text: text }] }
    ];

    const systemInstructionWithSkill = selectedSkillName
      ? buildSystemInstructionWithSkillByName(SYSTEM_INSTRUCTION, selectedSkillName)
      : buildSystemInstructionWithSkill(SYSTEM_INSTRUCTION, text);

    const detectedSkill = selectedSkillName ? null : detectSkill(text);
    const usarPesquisa = detectedSkill?.name === 'inteligencia_empresarial';
    const ferramentasAtivas = usarPesquisa ? searchTools : piespTools;

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      // Configuração do modelo
      const modelName = 'gemini-2.5-flash';

      // Configuração de Thinking (Pensamento)
      const thinkingConfig = mode === 'complete'
        ? { thinkingConfig: { thinkingBudget: 512 } }   // reduzido de 2048 → 512 para evitar erros 429/503
        : { thinkingConfig: { thinkingBudget: 0 } };

      // Log de confirmação: mostra qual skill está ativa e o tamanho do system instruction
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

      // Primeira chamada: envia a mensagem com as ferramentas selecionadas (com retry automático para 503)
      let response = await withRetry(() => ai.models.generateContent({
        model: modelName,
        contents: currentContents,
        config: {
          systemInstruction: systemInstructionWithSkill,
          tools: ferramentasAtivas,
          ...thinkingConfig
        }
      }));

      // Loop de Function Calling: executa ferramentas até o modelo retornar texto final
      // Máx 2: suficiente para chamar as duas bases (projetos + sem_valor) sem permitir
      // iteração ano-a-ano (que gera 4+ chamadas quando o modelo filtra por período)
      let maxIterations = 2;
      while (maxIterations > 0) {
        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts;
        
        // Verifica se houve chamada de ferramenta
        const functionCallPart = parts?.find((p: any) => p.functionCall);
        if (!functionCallPart || !functionCallPart.functionCall) break; // Sem tool call, temos a resposta final

        const fcall = functionCallPart.functionCall;

        // Executa a ferramenta localmente
        const resultado = await executarFerramenta(fcall.name!, fcall.args || {});

        // Monta o histórico com a resposta da ferramenta
        currentContents = [
          ...currentContents,
          { role: 'model' as const, parts: [{ functionCall: { name: fcall.name!, args: fcall.args || {} } }] },
          { role: 'user' as const, parts: [{ functionResponse: { name: fcall.name!, response: resultado } }] }
        ];

        // Segunda chamada: usa as mesmas ferramentas ativas (com retry automático para 503)
        response = await withRetry(() => ai.models.generateContent({
          model: modelName,
          contents: currentContents,
          config: {
            systemInstruction: systemInstructionWithSkill,
            tools: ferramentasAtivas,
            ...thinkingConfig
          }
        }));

        maxIterations--;
      }

      const responseText = response.text || "Não encontrei uma resposta para sua pergunta.";
      
      // Extração de fontes do Google Search Grounding
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      let sources: Source[] = [];

      if (groundingChunks) {
        const webSources = groundingChunks
          .map((chunk: any) => chunk.web)
          .filter((webSource: any) => webSource && webSource.uri && webSource.title)
          .map((webSource: any) => ({ uri: webSource.uri, title: webSource.title }));

        // Remove duplicatas baseadas na URI
        sources = webSources.filter((v: any, i: number, a: any[]) => a.findIndex((t) => t.uri === v.uri) === i);
      }

      const modelMessage: Message = {
        role: 'model',
        text: responseText,
        sources: sources.length > 0 ? sources : undefined
      };

      // Atualiza o histórico com a resposta do modelo para as próximas interações
      historyRef.current = [...currentContents, { role: 'model', parts: [{ text: responseText }] }];
      
      // Atualiza a UI com a resposta
      setMessages(prev => [...prev, modelMessage]);

    } catch (e: any) {
      const { msg: rawMsg, is503, is429, is500 } = getGeminiError(e);
      console.error('❌ Chat error details:', { is503, is429, is500, message: e?.message || e });

      // Fallback OpenRouter: tenta quando Gemini retorna 503 ou 429
      if ((is503 || is429) && OPENROUTER_API_KEY) {
        console.warn(`🔀 Gemini ${is503 ? '503' : '429'} detectado — ativando fallback OpenRouter...`);
        try {
          const result = await callOpenRouter(
            currentContents,
            systemInstructionWithSkill,
            ferramentasAtivas as any,
            executarFerramenta
          );
          const modelMessage: Message = { role: 'model', text: result.text };
          historyRef.current = [...currentContents, { role: 'model', parts: [{ text: result.text }] }];
          setMessages(prev => [...prev, modelMessage]);
          return; // sucesso via fallback
        } catch (orError: any) {
          console.error('❌ OpenRouter fallback também falhou:', orError?.message || orError);
        }
      } else if ((is503 || is429) && !OPENROUTER_API_KEY) {
        console.error('❌ Erro de cota/sobrecarga mas OPENROUTER_API_KEY não está configurada.');
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

  return { messages, sendMessage, isLoading, error };
};