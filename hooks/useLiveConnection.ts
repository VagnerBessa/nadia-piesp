
import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Tool, FunctionDeclaration, Type } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { SYSTEM_INSTRUCTION as DEFAULT_SYSTEM_INSTRUCTION } from '../utils/prompts';
import { GEMINI_API_KEY } from '../config';

// Audio settings
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const SCRIPT_PROCESSOR_BUFFER_SIZE = 4096;

export interface UseLiveConnectionOptions {
  systemInstruction?: string;
  tools?: Tool[];
  onToolCall?: (toolCall: any) => Promise<any>;
}

export const useLiveConnection = ({ systemInstruction, tools, onToolCall }: UseLiveConnectionOptions = {}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

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

      // Setup AnalyserNode for real-time visualization
      analyserRef.current = outputContext.createAnalyser();
      analyserRef.current.fftSize = 256; // Smaller FFT size for faster response
      analysisDataArrayRef.current = new Float32Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.connect(outputContext.destination);

      // Start the analysis loop
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = requestAnimationFrame(analysisLoop);

      console.log('[Nadia] Connecting to Gemini API...');
      sessionPromiseRef.current = ai.live.connect({
        // Using the latest Gemini 2.5 Flash Native Audio model (December 2025)
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('[Nadia] Connected to Gemini API successfully');
            setIsConnecting(false);
            setIsConnected(true);
            
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER_SIZE, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            let audioPacketCount = 0;
            let totalPackets = 0;
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              totalPackets++;

              // Log every 100 packets to show we're processing
              if (totalPackets % 100 === 0) {
                console.log('[Nadia] Processing audio packets... total:', totalPackets);
              }

              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);

              // Calculate RMS to detect if there's actual audio input
              let sumSquares = 0;
              for (let i = 0; i < inputData.length; i++) {
                sumSquares += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sumSquares / inputData.length);

              // Log only if there's significant audio input
              if (rms > 0.01) {
                audioPacketCount++;
                if (audioPacketCount % 50 === 0) { // Log every 50 packets with audio
                  console.log('[Nadia] Audio detected - RMS:', rms.toFixed(4), 'packet:', audioPacketCount);
                }
              }

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
            console.log('[Nadia] Message details:', {
              hasServerContent: !!message.serverContent,
              hasModelTurn: !!message.serverContent?.modelTurn,
              hasParts: !!message.serverContent?.modelTurn?.parts,
              partsLength: message.serverContent?.modelTurn?.parts?.length || 0,
              hasToolCall: !!message.toolCall,
              hasSetupComplete: !!(message as any).setupComplete,
              hasTurnComplete: !!(message as any).turnComplete
            });

            // Check if this is just a setup complete message
            if ((message as any).setupComplete) {
              console.log('[Nadia] Setup complete message received');
              return; // Don't close connection on setup
            }

            console.log('[Nadia] Message type:', message.serverContent?.modelTurn ? 'modelTurn' : message.toolCall ? 'toolCall' : 'other');
             // Handle Function Calls (Tool Use)
             if (message.toolCall) {
                console.log('[Nadia] Tool call detected');
                const functionCalls = message.toolCall.functionCalls;
                if (functionCalls && functionCalls.length > 0 && onToolCallRef.current) {
                    // Execute tool logic
                    for (const call of functionCalls) {
                        try {
                            console.log("Calling tool:", call.name, call.args);
                            const result = await onToolCallRef.current(call);
                            
                            // Send response back to model
                            sessionPromiseRef.current!.then((session) => {
                                session.sendToolResponse({
                                    functionResponses: [{
                                        id: call.id,
                                        name: call.name,
                                        response: { result: result }
                                    }]
                                });
                            });
                        } catch (err) {
                            console.error("Tool execution failed:", err);
                             sessionPromiseRef.current!.then((session) => {
                                session.sendToolResponse({
                                    functionResponses: [{
                                        id: call.id,
                                        name: call.name,
                                        response: { error: "Failed to execute tool" }
                                    }]
                                });
                            });
                        }
                    }
                }
             }


             // Handle Audio Output
             const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
             if (base64EncodedAudioString && outputAudioContextRef.current && analyserRef.current) {
                console.log('[Nadia] Received audio response from API');
                setIsSpeaking(true);
                const currentOutputContext = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentOutputContext.currentTime);

                const audioBuffer = await decodeAudioData(
                    decode(base64EncodedAudioString),
                    currentOutputContext,
                    OUTPUT_SAMPLE_RATE,
                    1,
                );

                const source = currentOutputContext.createBufferSource();
                source.buffer = audioBuffer;
                // Connect source to analyser, and analyser to destination
                source.connect(analyserRef.current);
                
                source.addEventListener('ended', () => {
                    audioSourcesRef.current.delete(source);
                    if (audioSourcesRef.current.size === 0) {
                        setIsSpeaking(false);
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
                setIsSpeaking(false);
             }
          },
          onerror: (e: ErrorEvent) => {
            console.error("[Nadia] Session error:", e);
            console.error("[Nadia] Error details:", JSON.stringify(e, null, 2));
            setError(`Falha na conexão com a API: ${e.message || 'Erro desconhecido'}`);
            stopConversation();
          },
          onclose: (e: CloseEvent) => {
            console.log("[Nadia] Session closed:", e.code, e.reason);
            console.log("[Nadia] Close was initiated by:", e.wasClean ? 'clean shutdown' : 'unexpected');

            // Only show error if it wasn't a normal user-initiated closure
            if (e.code !== 1000 && isConnected) {
              console.error("[Nadia] Abnormal close code:", e.code, "reason:", e.reason);
              setError(`Conexão fechada inesperadamente: ${e.reason || 'Código ' + e.code}`);
            }

            // Don't call stopConversation if already stopped
            if (isConnected) {
              stopConversation();
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            // Usando Kore com o modelo nativo 2.5 para sotaque brasileiro correto
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          tools: tools || [
            { googleSearch: {} },
            {
              functionDeclarations: [
                {
                  name: 'consultar_projetos_piesp',
                  description: 'Usa esta ferramenta SEMPRE que o usuário perguntar sobre números, soma, listar ou consultar investimentos com valor divulgado do estado de SP (PIESP). Retorna os principais projetos confirmados com montante financeiro.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      ano: { type: Type.STRING, description: 'Ano de anúncio/registro do investimento. Não confunda com o período de execução. Para buscas de período ("entre 2026 e 2030"), use ano_inicio e ano_fim.' },
                      ano_inicio: { type: Type.STRING, description: 'Ano de início da execução do investimento (ex: "2026").' },
                      ano_fim: { type: Type.STRING, description: 'Ano de término da execução do investimento (ex: "2030").' },
                      municipio: { type: Type.STRING, description: 'O nome do município específico, se fornecido. Não usar para regiões administrativas.' },
                      regiao: { type: Type.STRING, description: 'Região administrativa. Ex: "Região Metropolitana de São Paulo", "Região Administrativa de Campinas".' },
                      setor: { type: Type.STRING, description: 'Setor econômico. Valores válidos EXATOS: "Agropecuária", "Comércio", "Indústria", "Infraestrutura", "Serviços".' },
                      termo_busca: { type: Type.STRING, description: 'Termo livre para buscar na descrição do investimento (ex: "inteligência artificial", "carro elétrico", "sustentabilidade").' }
                    }
                  }
                },
                {
                  name: 'consultar_anuncios_sem_valor',
                  description: 'Usa esta ferramenta para consultar projetos anunciados pelas empresas em SP dos quais *ainda não se sabe o valor financeiro*, APENAS QUANDO e SE o usuário demonstrar interesse nesses anúncios sem cifra.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      ano: { type: Type.STRING, description: 'O ano do anúncio/registro do investimento, ex: "2026"' },
                      ano_inicio: { type: Type.STRING, description: 'Ano de início da execução do investimento (ex: "2026").' },
                      ano_fim: { type: Type.STRING, description: 'Ano de término da execução do investimento (ex: "2030").' },
                      municipio: { type: Type.STRING, description: 'O nome do município específico, se fornecido. Não usar para regiões administrativas.' },
                      regiao: { type: Type.STRING, description: 'Região administrativa. Ex: "Região Metropolitana de São Paulo", "Região Administrativa de Campinas".' },
                      setor: { type: Type.STRING, description: 'Setor econômico. Valores válidos EXATOS: "Agropecuária", "Comércio", "Indústria", "Infraestrutura", "Serviços".' },
                      termo_busca: { type: Type.STRING, description: 'Termo livre para buscar na descrição.' }
                    }
                  }
                }
              ]
            }
          ],
          systemInstruction: systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
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

  return { isConnected, isSpeaking, isConnecting, error, audioLevel, startConversation, stopConversation };
};