import React from 'react';
import { useLiveConnection } from '../hooks/useLiveConnection';
import { consultarPiespData, consultarAnunciosSemValor } from '../services/piespDataService';
import { NadiaSphere } from './NadiaSphere';
import SoundWaveIcon from './SoundWaveIcon';
import { SwitchModeIcon } from './Icons';

interface VoiceViewProps {
  onNavigateHome: () => void;
}

const VoiceView: React.FC<VoiceViewProps> = ({ onNavigateHome }) => {
  const {
    isConnected,
    isSpeaking,
    isConnecting,
    audioLevel,
    error,
    startConversation,
    stopConversation
  } = useLiveConnection({
    onToolCall: async (toolCall) => {
      if (toolCall.name === 'consultar_projetos_piesp') {
        const { ano, municipio, regiao, tipo, setor, empresa } = toolCall.args;
        console.log("🛠️ Tool Executado: Filtrando PIESP Principal:", { ano, municipio, regiao, tipo, setor, empresa });
        const resultados = consultarPiespData({ ano, municipio, regiao, tipo, setor, empresa });
        return { sucesso: true, total_investimentos: resultados.total, projetos: resultados.projetos };
      }
      if (toolCall.name === 'consultar_anuncios_sem_valor') {
        const { ano, municipio, regiao, tipo, setor, empresa } = toolCall.args;
        console.log("🛠️ Tool Executado: Anúncios Sem Valor divulgado:", { ano, municipio, regiao, tipo, setor, empresa });
        const resultados = consultarAnunciosSemValor({ ano, municipio, regiao, tipo, setor, empresa });
        return { sucesso: true, total_investimentos: resultados.total, projetos: resultados.projetos };
      }
      return { error: 'Tool não reconhecido' };
    }
  });

  const isListening = isConnected && !isSpeaking;

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full p-4 sm:p-6">
      {/* Back button */}
      <button
        onClick={onNavigateHome}
        className="absolute top-6 right-6 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-800/70 hover:bg-slate-700/90 border border-slate-700 text-slate-300 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-500 backdrop-blur-sm shadow-lg"
        aria-label="Voltar à tela inicial"
        title="Voltar à tela inicial"
      >
        <SwitchModeIcon className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-medium leading-none">Voltar</span>
      </button>

      {/* Main content area with simplified single-column layout */}
      <main className="flex flex-col items-center justify-center gap-6 w-full max-w-6xl mx-auto">
        
        {/* Title */}
        <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
          Nadia
        </h2>
        
        {/* Nadia Sphere */}
        <div className="flex-shrink-0">
          <NadiaSphere
            size="medium"
            isListening={isListening}
            isSpeaking={isSpeaking}
            isConnecting={isConnecting}
            audioLevel={audioLevel}
          />
        </div>

        {/* Action Button and Status */}
        <div className="mt-4 flex flex-col items-center gap-4">
            <button
              onClick={isConnected ? stopConversation : startConversation}
              disabled={isConnecting}
              className={`
                flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 ease-in-out
                focus:outline-none focus:ring-4 focus:ring-rose-500/50
                disabled:opacity-50 disabled:cursor-not-allowed
                bg-slate-800/60 hover:bg-slate-800/90 flex-shrink-0
              `}
              aria-label={isConnected ? 'Parar conversa' : 'Iniciar conversa'}
            >
              {isConnecting ? (
                <div className="w-10 h-10 border-4 border-t-transparent border-slate-400 rounded-full animate-spin"></div>
              ) : (
                <SoundWaveIcon
                  className="w-12 h-12 text-rose-500"
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  audioLevel={audioLevel}
                />
              )}
            </button>
            <div className="h-8 flex items-center justify-center">
              {error ? (
                <p className="text-red-400">{error}</p>
              ) : (
                <p className="text-slate-400 text-lg transition-opacity duration-300">
                  {isConnecting ? "Conectando..." : isSpeaking ? "Falando..." : isListening ? "Ouvindo..." : "Pressione para falar"}
                </p>
              )}
            </div>
        </div>
      </main>
    </div>
  );
};

export default VoiceView;
