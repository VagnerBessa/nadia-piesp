import React, { useState, useEffect } from 'react';
import { useLiveConnection } from '../hooks/useLiveConnection';
import { consultarPiespData, consultarAnunciosSemValor } from '../services/piespDataService';
import { NadiaSphere } from './NadiaSphere';
import SoundWaveIcon from './SoundWaveIcon';
import { SwitchModeIcon } from './Icons';

interface VoiceViewProps {
  onNavigateHome: () => void;
}

const VoiceView: React.FC<VoiceViewProps> = ({ onNavigateHome }) => {
  const [toolProcessing, setToolProcessing] = useState(false);
  const [hasSpokenOnce, setHasSpokenOnce] = useState(false);
  
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
      setToolProcessing(true); // Engatilha o indicativo visual de busca
      if (toolCall.name === 'consultar_projetos_piesp') {
        const { ano, municipio, regiao, setor, termo_busca } = toolCall.args;
        console.log("🛠️ Tool Executado: Filtrando PIESP Principal:", { ano, municipio, regiao, setor, termo_busca });
        const resultados = consultarPiespData({ ano, municipio, regiao, setor, termo_busca });
        // Fôlego Artificial: Injeta um atraso programático para forçar a Nadia a ter um espaçamento temporal entre o Áudio Filler e a Resposta.
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { sucesso: true, total_investimentos: resultados.total, projetos: resultados.projetos };
      }
      if (toolCall.name === 'consultar_anuncios_sem_valor') {
        const { ano, municipio, regiao, setor, termo_busca } = toolCall.args;
        console.log("🛠️ Tool Executado: Anúncios Sem Valor divulgado:", { ano, municipio, regiao, setor, termo_busca });
        const resultados = consultarAnunciosSemValor({ ano, municipio, regiao, setor, termo_busca });
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { sucesso: true, total_investimentos: resultados.total, projetos: resultados.projetos };
      }
      return { error: 'Tool não reconhecido' };
    }
  });

  useEffect(() => {
    if (isSpeaking) setHasSpokenOnce(true);
    if (!isConnected) setHasSpokenOnce(false);
  }, [isSpeaking, isConnected]);

  // Limpa o aviso de "buscando informações" instantaneamente quando a IA começar a responder o áudio
  useEffect(() => {
    if (isSpeaking || !isConnected) {
      setToolProcessing(false);
    }
  }, [isSpeaking, isConnected]);

  const isListening = isConnected && !isSpeaking && !toolProcessing;

  return (
    <div className="relative flex flex-col w-full h-full p-6 overflow-hidden">

      {/* Título Superior */}
      <div className="flex-shrink-0 flex flex-col items-center mt-4 sm:mt-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tighter">
          Nadia
        </h2>
        <div className="h-0.5 w-8 bg-rose-500/50 rounded-full mt-1" />
      </div>

      {/* Área Central: Imersão Total na Esfera e Legendas */}
      <div className="flex-grow relative w-full flex flex-col justify-center items-center overflow-visible mt-8">
        
        {/* Container das Legendas */}
        <div className={`absolute top-0 w-full px-4 sm:px-8 pr-28 sm:pr-32 max-w-3xl z-10 transition-all duration-[1000ms] ${hasSpokenOnce ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
           <p className="text-xl sm:text-2xl font-medium text-white/90 leading-relaxed tracking-tight text-left">
             {currentTranscript}
             {isSpeaking && <span className="inline-block w-2 h-5 ml-2 bg-rose-400 animate-pulse align-middle" />}
           </p>
        </div>

        {/* Container animado da Esfera */}
        <div 
          className={`absolute z-20 transition-all duration-[1000ms] ease-[cubic-bezier(0.23,1,0.32,1)]
            ${hasSpokenOnce 
              ? 'top-0 right-0 translate-x-0 translate-y-0 scale-[0.25] origin-top-right opacity-80' 
              : 'top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 scale-100 origin-center opacity-100'
            }
          `}
        >
          {/* Efeito de Bloom/Glow pulsante */}
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

      {/* Controles Inferiores (Bottom Zone) */}
      <div className="flex-shrink-0 flex flex-col items-center gap-6 pb-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
        
        {/* Status Text with fixed height to prevent layout shift */}
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

        {/* Big Mic Button - Centro Ergonômico */}
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

          {/* Anéis de pulso decorativos quando ativo */}
          {isConnected && isListening && (
            <div className="absolute inset-0 rounded-full border-2 border-rose-500 animate-ping opacity-20" />
          )}
        </button>

        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
          {isConnected ? "Toque para encerrar" : "Toque para iniciar"}
        </p>
      </div>
    </div>
  );
};

export default VoiceView;
