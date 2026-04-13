
import { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { SYSTEM_INSTRUCTION } from '../utils/prompts';
import { GEMINI_API_KEY } from '../config';
import { consultarPiespData, consultarAnunciosSemValor, getMetadados } from '../services/piespDataService';
import { buildSystemInstructionWithSkill, detectSkill } from '../services/skillDetector';

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
  parts: { text: string }[];
}

export type ResponseMode = 'fast' | 'complete';

const initialMessage: Message = {
    role: 'model',
    text: 'Olá! Sou a Nadia, assistente de IA da Fundação Seade. Posso consultar o banco de dados de investimentos confirmados no Estado de São Paulo (PIESP), incluindo uma base secundária de anúncios sem valores divulgados. O que gostaria de saber?'
};

// Carregado uma vez — os metadados não mudam durante a sessão
const _metadados = getMetadados();

// Ferramentas PIESP: function calling para dados estruturados
// (não pode ser combinado com googleSearch na mesma chamada)
// Inclui os valores reais de regiões para que o Gemini não precise adivinhar.
const regiaoDesc = _metadados.regioes.length > 0
  ? `Região administrativa do Estado de SP. Valores válidos: ${_metadados.regioes.join(', ')}. Usar quando o usuário perguntar por região, não por município específico.`
  : 'A região administrativa do Estado de SP, ex: "Região Metropolitana de São Paulo". Usar quando o usuário perguntar por região, não por município.';

const piespTools = [
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
            setor: { type: Type.STRING, description: 'Setor econômico. Valores válidos EXATOS: "Agropecuária", "Comércio", "Indústria", "Infraestrutura", "Serviços". Use APENAS estes valores — não invente variações.' },
            termo_busca: { type: Type.STRING, description: 'Termo livre para buscar na descrição do investimento (ex: "inteligência artificial", "carro elétrico", "sustentabilidade"). NÃO usar para setores — use o parâmetro setor.' }
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
            municipio: { type: Type.STRING, description: 'O nome do município, se fornecido' },
            regiao: { type: Type.STRING, description: regiaoDesc },
            setor: { type: Type.STRING, description: 'Setor econômico. Valores válidos EXATOS: "Agropecuária", "Comércio", "Indústria", "Infraestrutura", "Serviços".' },
            termo_busca: { type: Type.STRING, description: 'Termo livre para buscar na descrição do investimento. NÃO usar para setores.' }
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
function executarFerramenta(nome: string, args: any): any {
  if (nome === 'consultar_projetos_piesp') {
    let resultados = consultarPiespData({ ano: args.ano, municipio: args.municipio, regiao: args.regiao, setor: args.setor, termo_busca: args.termo_busca });
    // Se retornou 0 com filtro de ano, tenta sem — o modelo pode ter adicionado
    // um ano específico para uma consulta de período ("depois de 2020", "desde 2021")
    if (resultados.total === 0 && args.ano) {
      const semAno = consultarPiespData({ municipio: args.municipio, regiao: args.regiao, setor: args.setor, termo_busca: args.termo_busca });
      if (semAno.total > 0) resultados = semAno;
    }
    return { sucesso: true, total_investimentos: resultados.total, projetos: resultados.projetos };
  }
  if (nome === 'consultar_anuncios_sem_valor') {
    let resultados = consultarAnunciosSemValor({ ano: args.ano, municipio: args.municipio, regiao: args.regiao, setor: args.setor, termo_busca: args.termo_busca });
    if (resultados.total === 0 && args.ano) {
      const semAno = consultarAnunciosSemValor({ municipio: args.municipio, regiao: args.regiao, setor: args.setor, termo_busca: args.termo_busca });
      if (semAno.total > 0) resultados = semAno;
    }
    return { sucesso: true, total_investimentos: resultados.total, projetos: resultados.projetos };
  }
  return { error: 'Ferramenta não reconhecida' };
}

export const useChat = () => {
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

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      // Prepara o conteúdo com o histórico para manter o contexto da conversa
      const contents: HistoryItem[] = [
        ...historyRef.current,
        { role: 'user', parts: [{ text: text }] }
      ];
      
      // Configuração do modelo
      const modelName = 'gemini-2.5-flash';
      
      // Configuração de Thinking (Pensamento)
      const thinkingConfig = mode === 'complete' 
        ? { thinkingConfig: { thinkingBudget: 2048 } } 
        : { thinkingConfig: { thinkingBudget: 0 } };

      // Detecta e injeta a skill especializada (se houver) para esta pergunta específica
      const systemInstructionWithSkill = buildSystemInstructionWithSkill(SYSTEM_INSTRUCTION, text);

      // Detecta a skill e decide qual conjunto de ferramentas usar:
      // - inteligencia_empresarial e buscas de contexto usam Google Search
      // - tudo mais usa function calling PIESP
      // (as duas não podem ser combinadas na mesma chamada da generateContent API)
      const detectedSkill = detectSkill(text);
      const usarPesquisa = detectedSkill?.name === 'inteligencia_empresarial';
      const ferramentasAtivas = usarPesquisa ? searchTools : piespTools;

      // Primeira chamada: envia a mensagem com as ferramentas selecionadas
      let response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction: systemInstructionWithSkill,
          tools: ferramentasAtivas,
          ...thinkingConfig
        }
      });

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
        const resultado = executarFerramenta(fcall.name!, fcall.args || {});

        // Monta o histórico com a resposta da ferramenta
        const updatedContents = [
          ...contents,
          { role: 'model' as const, parts: [{ functionCall: { name: fcall.name!, args: fcall.args || {} } }] },
          { role: 'user' as const, parts: [{ functionResponse: { name: fcall.name!, response: resultado } }] }
        ];

        // Segunda chamada: usa as mesmas ferramentas ativas (mantém a skill)
        response = await ai.models.generateContent({
          model: modelName,
          contents: updatedContents,
          config: {
            systemInstruction: systemInstructionWithSkill,
            tools: ferramentasAtivas,
            ...thinkingConfig
          }
        });

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
      historyRef.current = [...contents, { role: 'model', parts: [{ text: responseText }] }];
      
      // Atualiza a UI com a resposta
      setMessages(prev => [...prev, modelMessage]);

    } catch (e: any) {
      console.error("Chat error:", e);
      console.error("Chat error details:", e?.message, e?.status, JSON.stringify(e?.response?.data || e?.details || ''));
      const errorMessage = `Erro: ${e?.message || 'Falha desconhecida ao conectar com a API.'}`;
      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return { messages, sendMessage, isLoading, error };
};