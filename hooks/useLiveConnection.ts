
import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Tool, FunctionDeclaration, Type } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { SYSTEM_INSTRUCTION as DEFAULT_SYSTEM_INSTRUCTION } from '../utils/prompts';
import { GEMINI_API_KEY } from '../config';
import { getMetadados } from '../services/piespDataService';

// Lazy: só chama getMetadados() quando o chat de voz for usado de fato
let _regiaoDescCache: string | null = null;
async function getRegiaoDesc(): Promise<string> {
  if (_regiaoDescCache) return _regiaoDescCache;
  const meta = await getMetadados();
  _regiaoDescCache = meta.regioes.length > 0
    ? `Região administrativa do Estado de SP. Valores válidos: ${meta.regioes.join(', ')}. Usar quando o usuário perguntar por região, não por município específico.`
    : 'A região administrativa do Estado de SP, ex: "Região Metropolitana de São Paulo". Usar quando o usuário perguntar por região, não por município.';
  return _regiaoDescCache;
}

// Audio settings
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const SCRIPT_PROCESSOR_BUFFER_SIZE = 2048;

export interface UseLiveConnectionOptions {
  systemInstruction?: string;
  tools?: Tool[];
  onToolCall?: (toolCall: any) => Promise<any>;
}

export const useLiveConnection = ({ systemInstruction, tools, onToolCall }: UseLiveConnectionOptions = {}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef<boolean>(false);
  const [toolProcessing, setToolProcessing] = useState(false);
  const toolProcessingRef = useRef<boolean>(false);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const isConnectedRef = useRef(false);
  const pendingDisconnectRef = useRef<boolean>(false);
  // FIX: Changed LiveSession to any as the type is not exported.
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Refs for real-time audio analysis
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analysisDataArrayRef = useRef<Float32Array | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const isSpeakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasClearedForTurnRef = useRef<boolean>(false);

  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

  // Ref for tool callback to access latest state/props
  const onToolCallRef = useRef(onToolCall);
  useEffect(() => {
    onToolCallRef.current = onToolCall;
  }, [onToolCall]);


  const cleanup = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    // Stop microphone stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    // Disconnect script processor
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
     // Disconnect analyser
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    // Close audio contexts
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close();
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close();
    }
    // Stop any playing audio
    for (const source of audioSourcesRef.current.values()) {
        source.stop();
    }
    audioSourcesRef.current.clear();
    
    // Reset refs
    sessionPromiseRef.current = null;
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    nextStartTimeRef.current = 0;
    setAudioLevel(0);
  }, []);


  const stopConversation = useCallback(async () => {
    // Persistindo o Timestamp sem condicional (evita o bug de stale closure do React com isConnected false)
    localStorage.setItem('nadia_last_interaction', Date.now().toString());

    setError(null);
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session:", e);
      }
    }
    cleanup();
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
  }, [cleanup]);

  useEffect(() => {
    return () => {
      stopConversation();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time audio analysis loop
  const analysisLoop = useCallback(() => {
    if (analyserRef.current && analysisDataArrayRef.current) {
      analyserRef.current.getFloatTimeDomainData(analysisDataArrayRef.current);
      
      let sumOfSquares = 0.0;
      for (const amplitude of analysisDataArrayRef.current) {
        sumOfSquares += amplitude * amplitude;
      }
      const rms = Math.sqrt(sumOfSquares / analysisDataArrayRef.current.length);
      const amplifiedRms = Math.min(1.0, rms * 7); // Amplify for better visual effect
      setAudioLevel(amplifiedRms);
    } else {
        // Smoothly decay to zero if not speaking
        setAudioLevel(prev => {
            const newLevel = prev * 0.92;
            return newLevel < 0.01 ? 0 : newLevel;
        });
    }
    animationFrameIdRef.current = requestAnimationFrame(analysisLoop);
  }, []);

  const startConversation = useCallback(async () => {
    console.log('[Nadia] Starting conversation...');
    setError(null);
    setIsConnecting(true);
    setCurrentTranscript('');
    pendingDisconnectRef.current = false;

    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = 'Seu navegador não suporta acesso ao microfone. Use Chrome, Firefox ou Edge.';
      console.error('[Nadia]', errorMsg);
      setError(errorMsg);
      setIsConnecting(false);
      return;
    }

    try {
      console.log('[Nadia] Requesting microphone access...');
      console.log('[Nadia] Navigator:', navigator.mediaDevices);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('[Nadia] Microphone access granted');
      console.log('[Nadia] Audio tracks:', stream.getAudioTracks());
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      console.log('[Nadia] GoogleGenAI initialized with API key:', GEMINI_API_KEY ? 'Present' : 'Missing');

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
      const outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
      outputAudioContextRef.current = outputContext;

      // iOS Safari e Chrome Android suspendem o AudioContext mesmo criado durante
      // gesto do usuário. resume() garante que o contexto esteja ativo.
      if (outputContext.state === 'suspended') {
        await outputContext.resume();
      }
      if (inputAudioContextRef.current.state === 'suspended') {
        await inputAudioContextRef.current.resume();
      }

      // Chrome Android bloqueia reprodução real de áudio se ela não ocorrer
      // diretamente no gesto do usuário. Tocar um buffer silencioso imediatamente
      // "desbloqueia" o contexto para reproduções futuras (resposta da Nadia).
      const silentBuffer = outputContext.createBuffer(1, 1, OUTPUT_SAMPLE_RATE);
      const silentSource = outputContext.createBufferSource();
      silentSource.buffer = silentBuffer;
      silentSource.connect(outputContext.destination);
      silentSource.start(0);

      // Setup AnalyserNode for real-time visualization
      analyserRef.current = outputContext.createAnalyser();
      analyserRef.current.fftSize = 256; // Smaller FFT size for faster response
      analysisDataArrayRef.current = new Float32Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.connect(outputContext.destination);

      // Start the analysis loop
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = requestAnimationFrame(analysisLoop);

      let finalSystemInstruction = systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;

      // Modificador de Anti-Amnésia: Cálculo do tempo desde a última conexão
      const lastInteractionStr = localStorage.getItem('nadia_last_interaction');
      if (lastInteractionStr) {
        const lastInteraction = parseInt(lastInteractionStr, 10);
        const diffMs = Date.now() - lastInteraction;
        const diffHours = diffMs / (1000 * 60 * 60);
        
        // Se ocorreu há menos de 24 horas, recarregamos a memória. Não existe limite mínimo (até um duplo clique instantâneo deve manter a memória).
        // Se ocorreu há menos de 24 horas, recarregamos a memória. Não existe limite mínimo.
        if (diffHours < 24) {
          const diffMinutes = Math.round(diffMs / (1000 * 60));
          const timeDesc = diffHours >= 1 
            ? `${Math.round(diffHours)} hora(s)` 
            : `${diffMinutes} minuto(s)`;
            
          // REMOVE a exigência de apresentação do prompt base para não haver conflito ("cognitive dissonance" do modelo)
          finalSystemInstruction = finalSystemInstruction.replace(
            /Apresente-se de forma amigável dizendo quem você é.*?depois da primeira fala\./gs,
            ""
          );
            
          finalSystemInstruction += `\n\n[INSTRUÇÃO DE ESTADO DE SESSÃO]\nA conversa foi pausada temporariamente pelo usuário há ${timeDesc} e agora foi retomada. O usuário já te conhece muito bem e você lembra dele. Inicie essa nova sessão com uma retomada muito natural, calorosa e breve (Ex: "Oi de novo, como continuamos?", "Pronto, pode falar!", "Olá novamente, em que posso ajudar agora?"). Evite soar robótica.`;
        }
      }

      // Adicionando a Diretriz de UX/Voice com Trava Psicológica, Desocultamento Progressivo e Graceful Fallback Flexível
      finalSystemInstruction += `\n\n[COMPORTAMENTO ACÚSTICO E BUSCA DE DADOS]\nREGRA DE APRESENTAÇÃO: Se o usuário iniciar a conversa te chamando pelo nome (Nadia), NUNCA se apresente dizendo quem você é. Vá direto ao assunto.\nIMPORTANTE SOBRE FERRAMENTAS: Se você precisar consultar a base de dados do PIESP, você OBRIGATORIAMENTE deve avisar o usuário ANTES de chamar a ferramenta, usando uma frase preenchedora MUITO CURTA (ex: "Um instante", "Vou buscar os dados..."). Fale apenas essa frase curta e acione a ferramenta.\nREGRAS DE EXPOSIÇÃO PROGRESSIVA (CRÍTICO): Ao retornar dados da base, NUNCA vomite uma lista de projetos. Dê APENAS o resumo Macro (Total de Bilhões/Milhões e a tendência geral). Finalize SEMPRE com uma pergunta suave para ancorar a navegação do usuário (Ex: "Encontrei X bilhões. Deseja que eu detalhe as principais empresas envolvidas?"). ATENÇÃO: APÓS FAZER A PERGUNTA, VOCÊ DEVE PARAR DE FALAR IMEDIATAMENTE. É ESTRITAMENTE PROIBIDO detalhar as empresas logo em seguida na mesma fala. Espere o usuário responder "Sim".\nREGRA DE CONTINUIDADE (MEMÓRIA CONVERSACIONAL): Quando o usuário pedir para detalhar uma informação que você acabou de dar, NÃO repita o valor macro. Entre direto nos detalhes solicitados (Ex: "Claro! As principais empresas são...").\nTRATAMENTO DE NULOS (GRACEFUL FALLBACK): Se a pesquisa retornar zerada, sugira uma alternativa. Se o usuário aceitar com um "Sim", aja imediatamente (dispare a ferramenta) sem hesitar. NUNCA DISPARE A FERRAMENTA DE FALLBACK OU SECUNDÁRIA ANTES DE OUVIR O "SIM" DO USUÁRIO.`;

      console.log('[Nadia] Connecting to Gemini API...');
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('[Nadia] Connected to Gemini API successfully');
            setIsConnecting(false);
            setIsConnected(true);
            
            // UX Hack: Gatilho inicial invisível.
            // O Gemini Live espera o usuário falar primeiro para iniciar a geração.
            // Ao enviar um 'Oi' de texto silencioso imediatamente após a conexão abrir,
            // forçamos a Nadia a se apresentar de imediato sem latência perceptível.
            sessionPromiseRef.current?.then((session) => {
               try {
                 session.send({
                   clientContent: {
                     turns: [{ role: 'user', parts: [{ text: 'Oi' }] }],
                     turnComplete: true
                   }
                 });
               } catch(err) {
                 console.error('[Nadia] Erro ao enviar trigger inicial:', err);
               }
            });

            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER_SIZE, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);

              // Se a IA está se despedindo ou FALANDO, fechar o microfone para evitar que ruído/eco corte a IA (desativa barge-in)
              // NOTA: NÃO mutar durante toolProcessing — o Gemini Live API exige fluxo de áudio contínuo para manter o WebSocket vivo
              if (pendingDisconnectRef.current || isSpeakingRef.current) return;

              const pcmBlob = createBlob(inputData);
              sessionPromiseRef.current!.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch((err) => {
                console.error('[Nadia] Error sending audio:', err);
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            console.log('[Nadia] Received message from API:', message);
            if ((message as any).setupComplete) return;

             if (message.toolCall) {
                const functionCalls = message.toolCall.functionCalls;
                if (functionCalls && functionCalls.length > 0 && onToolCallRef.current) {
                    for (const call of functionCalls) {
                        if (call.name === 'encerrar_sessao') {
                           console.log('[Nadia] Usuário se despediu. Fechando mic e aguardando 4s para matar o socket...');
                           pendingDisconnectRef.current = true;
                           
                           // Agendando o assassinato da conexão em 4 segundos (tempo do Tchau terminar na caixa de som)
                           setTimeout(stopConversation, 4000);

                           sessionPromiseRef.current!.then((session) => {
                             session.sendToolResponse({
                               functionResponses: [{ id: call.id, name: call.name, response: { result: "Conexão cortada fisicamente. É TERMINANTEMENTE PROIBIDO falar mais alguma coisa a partir de agora." } }]
                             });
                           });
                           continue;
                        }

                        try {
                            // Muta o mic durante o processamento da ferramenta
                            toolProcessingRef.current = true;
                            setToolProcessing(true);

                            const result = await onToolCallRef.current(call);
                            
                            // UX Hack: Atraso artificial de 2.5s para não "engolir" a frase de transição.
                            // Como a ferramenta local executa em milissegundos, se devolvermos a resposta 
                            // imediatamente, o Gemini interrompe a frase "Vou pesquisar..." no meio para 
                            // começar a falar os resultados. O atraso garante que a fala termine.
                            setTimeout(() => {
                                toolProcessingRef.current = false;
                                setToolProcessing(false);
                                sessionPromiseRef.current?.then((session) => {
                                    session.sendToolResponse({
                                        functionResponses: [{ id: call.id, name: call.name, response: { result: result } }]
                                    });
                                });
                            }, 2500);
                        } catch (err) {
                             sessionPromiseRef.current!.then((session) => {
                                session.sendToolResponse({
                                    functionResponses: [{ id: call.id, name: call.name, response: { error: "Failed to execute tool" } }]
                                });
                            });
                        }
                    }
                }
             }

             if (message.serverContent?.turnComplete) {
                // Ao invés de apagar, apenas pulamos linha para o próximo bloco de fala
                setCurrentTranscript(prev => {
                  if (prev.endsWith('\n\n')) return prev;
                  return prev + '\n\n';
                });
             }

             // CAPTURA A TRANSCRIÇÃO OFICIAL DO ÁUDIO DA IA
             if (message.serverContent?.outputTranscription?.text) {
               setCurrentTranscript(prev => prev + message.serverContent!.outputTranscription!.text);
             }

             // Ignoramos message.serverContent?.modelTurn?.parts para texto, pois isso contém o RACIOCÍNIO INTERNO (inglês) do modelo gemini-2.0-flash-exp!
             // Pegamos apenas o áudio dele:
             const base64EncodedAudioString = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64EncodedAudioString && outputAudioContextRef.current && analyserRef.current) {
                // Cancela o timeout de fim de fala se existir, para evitar piscar o estado
                if (isSpeakingTimeoutRef.current) {
                  clearTimeout(isSpeakingTimeoutRef.current);
                  isSpeakingTimeoutRef.current = null;
                }
                
                setIsSpeaking(true);
                isSpeakingRef.current = true;
                const currentOutputContext = outputAudioContextRef.current;
                if (currentOutputContext.state === 'suspended') {
                  await currentOutputContext.resume();
                }

                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentOutputContext.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), currentOutputContext, OUTPUT_SAMPLE_RATE, 1);

                const source = currentOutputContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(analyserRef.current);
                source.addEventListener('ended', () => {
                    audioSourcesRef.current.delete(source);
                    if (audioSourcesRef.current.size === 0) {
                        // Desmuta o mic INSTANTANEAMENTE para que o usuário possa responder
                        isSpeakingRef.current = false;

                        // Aplica um debounce visual de 2500ms antes de recolher a animação da UI
                        isSpeakingTimeoutRef.current = setTimeout(() => {
                           setIsSpeaking(false);
                           isSpeakingTimeoutRef.current = null;
                        }, 2500);
                    }
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                audioSourcesRef.current.add(source);
             }

             const interrupted = message.serverContent?.interrupted;
             if (interrupted) {
                for (const source of audioSourcesRef.current.values()) {
                    source.stop();
                }
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                if (isSpeakingTimeoutRef.current) {
                  clearTimeout(isSpeakingTimeoutRef.current);
                  isSpeakingTimeoutRef.current = null;
                }
                setIsSpeaking(false);
                isSpeakingRef.current = false;
             }
          },
          onerror: (e: ErrorEvent) => {
            setError(`Falha na conexão com a API: ${e.message || 'Erro desconhecido'}`);
            stopConversation();
          },
          onclose: (e: CloseEvent) => {
            if (e.code !== 1000 && isConnectedRef.current) setError(`Conexão fechada inesperadamente: ${e.reason || 'Código ' + e.code}`);
            if (isConnectedRef.current) stopConversation();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: { },
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          tools: tools || await (async () => {
            const rd = await getRegiaoDesc();
            return [
            { googleSearch: {} },
            {
              functionDeclarations: [
                {
                  name: 'consultar_projetos_piesp',
                  description: 'Usa esta ferramenta SEMPRE que o usuário perguntar sobre números, soma, listar ou consultar investimentos com valor divulgado do estado de SP (PIESP). Retorna os principais projetos confirmados com montante financeiro. INSTRUÇÃO VITAL: Diga "Vou pesquisar esses investimentos para você..." ANTES de invocar.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      ano: { type: Type.STRING, description: 'Ano EXATO. Use SOMENTE quando o usuário pede especificamente "em [ano]" ou "no ano [ano]". NUNCA use para expressões de período: "depois de", "após", "desde", "a partir de", "entre", "últimos N anos", "recentes". Nesses casos OMITA este campo completamente — a ferramenta retorna todos os anos disponíveis.' },
                      municipio: { type: Type.STRING, description: 'O nome do município específico, se fornecido. Não usar para regiões administrativas.' },
                      regiao: { type: Type.STRING, description: rd },
                      setor: { type: Type.STRING, description: 'Setor econômico GERAL. Valores válidos EXATOS: "Agropecuária", "Comércio", "Indústria", "Infraestrutura", "Serviços". ATENÇÃO: atividades específicas como saúde, educação, tecnologia, farmácia, hospital NÃO são setores — use termo_busca para essas buscas.' },
                      termo_busca: { type: Type.STRING, description: 'Busca por atividade econômica específica em múltiplos campos, incluindo CNAE. Use para: "saúde", "hospital", "farmácia", "educação", "tecnologia", "energia solar", "data center", "veículo elétrico" etc. PREFIRA este campo quando o usuário mencionar uma atividade que não é um dos 5 setores gerais.' }
                    }
                  }
                },
                {
                  name: 'consultar_anuncios_sem_valor',
                  description: 'Usa esta ferramenta para consultar projetos anunciados pelas empresas em SP dos quais *ainda não se sabe o valor financeiro*, APENAS QUANDO e SE o usuário demonstrar interesse nesses anúncios sem cifra. INSTRUÇÃO VITAL: Diga "Um momento, vou procurar..." ANTES de invocar.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      ano: { type: Type.STRING, description: 'Ano EXATO. Use SOMENTE quando o usuário pede especificamente "em [ano]" ou "no ano [ano]". NUNCA use para expressões de período: "depois de", "após", "desde", "a partir de", "entre", "últimos N anos", "recentes". Nesses casos OMITA este campo completamente — a ferramenta retorna todos os anos disponíveis.' },
                      municipio: { type: Type.STRING, description: 'O nome do município específico, se fornecido. Não usar para regiões administrativas.' },
                      regiao: { type: Type.STRING, description: rd },
                      setor: { type: Type.STRING, description: 'Setor econômico GERAL. Valores válidos EXATOS: "Agropecuária", "Comércio", "Indústria", "Infraestrutura", "Serviços". ATENÇÃO: atividades específicas como saúde, educação, tecnologia, farmácia, hospital NÃO são setores — use termo_busca para essas buscas.' },
                      termo_busca: { type: Type.STRING, description: 'Busca por atividade econômica específica em múltiplos campos, incluindo CNAE. Use para: "saúde", "hospital", "farmácia", "educação", "tecnologia", "energia solar", "data center", "veículo elétrico" etc. PREFIRA este campo quando o usuário mencionar uma atividade que não é um dos 5 setores gerais.' }
                    }
                  }
                },
                {
                  name: 'encerrar_sessao',
                  description: 'Acione quando o usuário se despedir ou afirmar explicitamente que não precisa de mais nada ("Tchau", "Obrigado, é só isso"). Diga uma despedida natural, calorosa e com ritmo vocal pausado e tranquilo (ex: "Foi um prazer, até a próxima!"). Nunca acelere a sua voz, fale devagar. Após a sua fala, acione essa ferramenta para desligar.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {}
                  }
                }
              ]
            }
          ];
          })(),
          systemInstruction: finalSystemInstruction,
        },
      });

    } catch (e: any) {
      console.error("[Nadia] Failed to start conversation:", e);
      console.error("[Nadia] Error name:", e.name);
      console.error("[Nadia] Error message:", e.message);

      let errorMessage = 'Falha ao acessar o microfone.';

      if (e.name === 'NotAllowedError') {
        errorMessage = 'Permissão de microfone negada. Por favor, permita o acesso ao microfone nas configurações do navegador.';
      } else if (e.name === 'NotFoundError') {
        errorMessage = 'Nenhum microfone encontrado. Por favor, conecte um microfone.';
      } else if (e.name === 'NotReadableError') {
        errorMessage = 'O microfone está sendo usado por outro aplicativo. Feche outros aplicativos que possam estar usando o microfone.';
      } else if (e.name === 'OverconstrainedError') {
        errorMessage = 'Configurações de áudio incompatíveis com o microfone.';
      } else if (e.name === 'SecurityError') {
        errorMessage = 'Erro de segurança. Certifique-se de estar usando HTTPS ou localhost.';
      } else if (e.message) {
        errorMessage = `Erro: ${e.message}`;
      }

      setError(errorMessage);
      setIsConnecting(false);
      cleanup();
    }
  }, [stopConversation, cleanup, analysisLoop, systemInstruction, tools]);

  return { isConnected, isSpeaking, isConnecting, error, audioLevel, currentTranscript, toolProcessing, startConversation, stopConversation };
};