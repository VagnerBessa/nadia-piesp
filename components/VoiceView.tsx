import React, { useState, useEffect, useRef } from 'react';
import { useLiveConnection } from '../hooks/useLiveConnection';
import { consultarPiespData, consultarAnunciosSemValor } from '../services/piespDataService';
import { NadiaSphere } from './NadiaSphere';
import SoundWaveIcon from './SoundWaveIcon';

interface VoiceViewProps {
  onNavigateHome: () => void;
}

const VoiceView: React.FC<VoiceViewProps> = ({ onNavigateHome }) => {
  const [toolProcessing, setToolProcessing] = useState(false);
  const [hasSpokenOnce, setHasSpokenOnce] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);

  const {
    isConnected,
    isSpeaking,
    isConnecting,
    error,
    audioLevel,
    currentTranscript,
    startConversation,
    stopConversation
  } = useLiveConnection({
    onToolCall: async (toolCall) => {
      setToolProcessing(true);
      if (toolCall.name === 'consultar_projetos_piesp') {
        const { ano, municipio, regiao, setor, termo_busca } = toolCall.args;
        console.log("🛠️ Tool Executado: Filtrando PIESP Principal:", { ano, municipio, regiao, setor, termo_busca });
        const resultados = consultarPiespData({ ano, municipio, regiao, setor, termo_busca });
        return { sucesso: true, total_projetos: resultados.total_projetos, valor_total_milhoes: resultados.valor_total_milhoes, projetos: resultados.projetos };
      }
      if (toolCall.name === 'consultar_anuncios_sem_valor') {
        const { ano, municipio, regiao, setor, termo_busca } = toolCall.args;
        console.log("🛠️ Tool Executado: Anúncios Sem Valor divulgado:", { ano, municipio, regiao, setor, termo_busca });
        const resultados = consultarAnunciosSemValor({ ano, municipio, regiao, setor, termo_busca });
        return { sucesso: true, total_projetos: resultados.total, projetos: resultados.projetos };
      }
      if (toolCall.name === 'encerrar_sessao') {
        console.log("🛠️ Tool Executado: Encerrar sessão");
        return { sucesso: true };
      }
      return { error: 'Tool não reconhecido' };
    }
  });

  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const transcriptTextRef = useRef<HTMLSpanElement>(null);

  // Deriva turnos completos e turno ativo do currentTranscript.
  // useLiveConnection appenda '\n\n' no turnComplete — isso é o separador natural de turnos.
  const segments = currentTranscript.split('\n\n').filter(s => s.trim());
  const isLastTurnComplete = currentTranscript.endsWith('\n\n');
  const completedTurns = isLastTurnComplete ? segments : segments.slice(0, -1);
  const activeTurnText = isLastTurnComplete ? '' : (segments[segments.length - 1] || '');

  useEffect(() => {
    if (currentTranscript.length > 0) {
      setHasSpokenOnce(true);
    }
  }, [currentTranscript]);

  // Quando desconecta, volta ao modo imersivo para a esfera centralizar sem sobrepor o texto
  useEffect(() => {
    if (!isConnected && hasSpokenOnce) {
      setIsImmersive(true);
    }
  }, [isConnected, hasSpokenOnce]);

  // Typewriter via DOM direto — opera APENAS no turno ativo, sem React overhead.
  // Turnos completos são texto estático (React gerencia, sem custo de animação).
  useEffect(() => {
    if (!transcriptTextRef.current) return;

    if (!activeTurnText) {
      transcriptTextRef.current.textContent = '';
      return;
    }

    // Auto-scroll fora do loop de alta frequência de forma inteligente
    if (transcriptContainerRef.current && scrollAnchorRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = transcriptContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      if (isNearBottom) {
        scrollAnchorRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
    }

    // 1 char / 65ms ≈ 15 chars/s — calibrado para acompanhar a taxa real de fala em português.
    // A versão anterior (3 chars/30ms = 100 chars/s) era 6-8x mais rápida que o áudio,
    // revelando o texto completo em <1s enquanto a Nadia ainda falava por 8-10s.
    const intervalId = setInterval(() => {
      if (transcriptTextRef.current) {
        const currentLen = transcriptTextRef.current.textContent?.length || 0;
        if (currentLen < activeTurnText.length) {
          const nextLength = Math.min(currentLen + 1, activeTurnText.length);
          transcriptTextRef.current.textContent = activeTurnText.substring(0, nextLength);
          
          // Auto-scroll durante a digitação usando o âncora de forma inteligente
          if (scrollAnchorRef.current && transcriptContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = transcriptContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            if (isNearBottom) {
              scrollAnchorRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
            }
          }
        }
      }
    }, 65);

    return () => clearInterval(intervalId);
  }, [activeTurnText]);

  useEffect(() => {
    if (isSpeaking || !isConnected) {
      setToolProcessing(false);
    }
  }, [isSpeaking, isConnected]);

  const isListening = isConnected && !isSpeaking && !toolProcessing;
  const hasTranscript = currentTranscript.trim().length > 0;

  const handleDownload = () => {
    const date = new Date().toLocaleDateString('pt-BR');
    const text = segments
      .map((turn, i) => `[Turno ${i + 1}]\n${turn}`)
      .join('\n\n');
    const blob = new Blob(
      [`Nadia — Conversa em ${date}\n${'─'.repeat(36)}\n\n${text}`],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nadia-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative flex flex-col w-full h-full p-6 overflow-hidden">

      {/* Título Superior */}
      <div className="flex-shrink-0 flex flex-col items-center mt-4 sm:mt-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tighter">
          Nadia
        </h2>
        <div className="h-0.5 w-8 bg-rose-500/50 rounded-full mt-1" />
      </div>

      {/* Área Central: Esfera + Histórico de Turnos */}
      <div className="flex-grow relative w-full flex flex-col justify-center items-center overflow-visible mt-8">

        {/* Container de Transcrição — turnos empilhados com scroll */}
        <div
          ref={transcriptContainerRef}
          className={`absolute top-0 bottom-8 w-full px-4 sm:px-8 pr-28 sm:pr-32 max-w-3xl z-10 overflow-y-auto transition-all duration-[1000ms] ${hasSpokenOnce && !isImmersive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
        >
          {/* Turnos completos — estáticos, levemente esmaecidos para indicar que são histórico */}
          {completedTurns.map((turn, i) => (
            <div key={i} className="mb-5 pb-5 border-b border-white/5">
              <div className="text-[10px] font-bold text-rose-400/40 uppercase tracking-widest mb-1.5">
                Nadia
              </div>
              <p className="text-xl sm:text-2xl font-medium text-white/50 leading-relaxed tracking-tight whitespace-pre-wrap">
                {turn}
              </p>
            </div>
          ))}

          {/* Turno ativo — typewriter via ref, texto em destaque total */}
          <div className="pb-16">
            {activeTurnText && (
              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1.5">
                Nadia
              </div>
            )}
            <p className="text-xl sm:text-2xl font-medium text-white/90 leading-relaxed tracking-tight whitespace-pre-wrap">
              <span ref={transcriptTextRef}></span>
              {isSpeaking && <span className="inline-block w-2 h-5 ml-2 bg-rose-400 animate-pulse align-middle" />}
            </p>
            {/* Elemento âncora invisível para forçar a rolagem correta */}
            <div ref={scrollAnchorRef} className="h-4 w-full" />
          </div>
        </div>

        {/* Esfera — toque alterna entre modo imersivo (grande) e modo transcrição (pequena no canto) */}
        <div
          onClick={() => { if (hasSpokenOnce) setIsImmersive(prev => !prev); }}
          className={`absolute z-20 transition-all duration-[1000ms] ease-[cubic-bezier(0.23,1,0.32,1)]
            ${hasSpokenOnce && !isImmersive
              ? 'top-0 right-0 translate-x-0 translate-y-0 scale-[0.25] origin-top-right opacity-80'
              : 'top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 scale-100 origin-center opacity-100'
            }
            ${hasSpokenOnce ? 'cursor-pointer' : ''}
          `}
        >
          <div className={`absolute inset-0 rounded-full blur-[100px] transition-all duration-1000 ${
            isSpeaking ? 'bg-rose-500/30' : isListening ? 'bg-rose-500/10' : 'bg-transparent'
          }`} />

          <NadiaSphere
            size="large"
            isListening={isListening}
            isSpeaking={isSpeaking}
            isConnecting={isConnecting}
            audioLevel={audioLevel}
          />
        </div>
      </div>

      {/* Controles Inferiores */}
      <div className="flex-shrink-0 flex flex-col items-center gap-6 pb-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">

        <div className="h-10 flex items-center justify-center">
          {error ? (
            <p className="px-4 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium">
              {error}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              {isConnected && !isConnecting && (
                <div className={`w-1.5 h-1.5 rounded-full ${toolProcessing ? 'bg-cyan-400 animate-pulse' : isListening ? 'bg-rose-500 animate-pulse' : 'bg-slate-600'}`} />
              )}
              <p className="text-slate-400 text-lg sm:text-xl font-medium tracking-tight">
                {isConnecting ? "Conectando..." : toolProcessing ? "Buscando informações..." : isSpeaking ? "Nadia falando..." : isListening ? "Ouvindo você..." : "Pronta para conversar"}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={isConnected ? stopConversation : startConversation}
          disabled={isConnecting}
          className={`
            relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-500 ease-elastic
            focus:outline-none focus:ring-4 focus:ring-rose-500/20
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isConnected && !isConnecting
              ? 'bg-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.4)] scale-110'
              : 'bg-slate-800 border border-white/5 shadow-xl hover:bg-slate-700'}
            active:scale-90
          `}
          aria-label={isConnected ? 'Parar conversa' : 'Iniciar conversa'}
        >
          {isConnecting ? (
            <div className="w-10 h-10 border-[3px] border-t-transparent border-white rounded-full animate-spin" />
          ) : (
            <SoundWaveIcon
              className={`w-14 h-14 transition-colors duration-300 ${isConnected ? 'text-white' : 'text-rose-500'}`}
              isListening={isListening}
              isSpeaking={isSpeaking}
              audioLevel={audioLevel}
            />
          )}

          {isConnected && isListening && (
            <div className="absolute inset-0 rounded-full border-2 border-rose-500 animate-ping opacity-20" />
          )}
        </button>

        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
          {isConnected ? "Toque para encerrar" : "Toque para iniciar"}
        </p>

        {/* Botão de Download centralizado e elegante */}
        <div className={`transition-all duration-500 ${!isConnected && hasTranscript ? 'opacity-100 translate-y-0 h-auto mt-2 pointer-events-auto' : 'opacity-0 -translate-y-2 h-0 overflow-hidden pointer-events-none'}`}>
          <button
            onClick={handleDownload}
            aria-label="Baixar transcrição da conversa"
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all border border-white/5 shadow-lg active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest">Baixar Transcrição</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceView;
