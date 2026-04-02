
import { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { SYSTEM_INSTRUCTION } from '../utils/prompts';
import { GEMINI_API_KEY } from '../config';
import { consultarPiespData, consultarAnunciosSemValor } from '../services/piespDataService';

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

// Declarações de ferramentas para o modo chat
const piespTools = [
  {
    functionDeclarations: [
      {
        name: 'consultar_projetos_piesp',
        description: 'Usa esta ferramenta SEMPRE que o usuário perguntar sobre números, soma, listar ou consultar investimentos com valor divulgado do estado de SP (PIESP). Retorna os principais projetos confirmados com montante financeiro.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            ano: { type: Type.STRING, description: 'O ano do investimento, ex: "2026"' },
            municipio: { type: Type.STRING, description: 'O nome do município, se fornecido' }
          }
        }
      },
      {
        name: 'consultar_anuncios_sem_valor',
        description: 'Usa esta ferramenta para consultar projetos anunciados pelas empresas em SP dos quais ainda não se sabe o valor financeiro, APENAS QUANDO o usuário demonstrar interesse nesses anúncios sem cifra.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            ano: { type: Type.STRING, description: 'O ano do investimento, ex: "2026"' },
            municipio: { type: Type.STRING, description: 'O nome do município, se fornecido' }
          }
        }
      }
    ]
  }
];

// Executa a ferramenta localmente e retorna o resultado
function executarFerramenta(nome: string, args: any): any {
  if (nome === 'consultar_projetos_piesp') {
    const resultados = consultarPiespData({ ano: args.ano, municipio: args.municipio });
    return { sucesso: true, total_investimentos: resultados.total, projetos: resultados.projetos };
  }
  if (nome === 'consultar_anuncios_sem_valor') {
    const resultados = consultarAnunciosSemValor({ ano: args.ano, municipio: args.municipio });
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

      // Primeira chamada: envia a mensagem com as ferramentas disponíveis
      let response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: piespTools,
          ...thinkingConfig
        }
      });

      // Loop de Function Calling: executa ferramentas até o modelo retornar texto final
      let maxIterations = 3; // Segurança contra loop infinito
      while (maxIterations > 0) {
        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts;
        
        // Verifica se houve chamada de ferramenta
        const functionCallPart = parts?.find((p: any) => p.functionCall);
        if (!functionCallPart || !functionCallPart.functionCall) break; // Sem tool call, temos a resposta final

        const fcall = functionCallPart.functionCall;
        console.log("🛠️ Chat Tool Call:", fcall.name, fcall.args);

        // Executa a ferramenta localmente
        const resultado = executarFerramenta(fcall.name!, fcall.args || {});
        console.log("📊 Resultado da ferramenta:", resultado);

        // Monta o histórico com a resposta da ferramenta
        const updatedContents = [
          ...contents,
          { role: 'model' as const, parts: [{ functionCall: { name: fcall.name!, args: fcall.args || {} } }] },
          { role: 'user' as const, parts: [{ functionResponse: { name: fcall.name!, response: resultado } }] }
        ];

        // Segunda chamada: envia o resultado da ferramenta de volta ao modelo
        response = await ai.models.generateContent({
          model: modelName,
          contents: updatedContents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: piespTools,
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