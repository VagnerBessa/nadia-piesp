import React from 'react';
import SoundWaveIcon from './SoundWaveIcon';
import { NadiaSphere } from './NadiaSphere';

interface LandingPageProps {
  onNavigateToVoice: () => void;
  onNavigateToChat: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToVoice, onNavigateToChat }) => {
  return (
    <div className="flex flex-col w-full h-full px-6 py-6 md:py-10">

      {/* Seção Superior: Nome e Identidade */}
      <div className="flex flex-col items-center text-center mt-0 sm:mt-2 animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tighter leading-none mb-2">
          Nadia
        </h1>
        <div className="h-1 w-12 bg-rose-500 rounded-full mb-3 shadow-[0_0_12px_rgba(244,63,94,0.5)]" />
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">
          Núcleo de Análise de Dados <br/>e Inteligência Artificial
        </p>
      </div>

      {/* Seção Central: A Esfera (Estrela da Tela) */}
      <div className="flex-grow flex items-center justify-center py-4 my-2">
        <div className="relative group">
          {/* Brilho de fundo para profundidade */}
          <div className="absolute inset-0 bg-rose-500/15 blur-[80px] rounded-full group-hover:bg-rose-500/20 transition-all duration-700" />
          <NadiaSphere isListening={false} isSpeaking={false} isConnecting={false} audioLevel={0} size="medium" />
        </div>
      </div>

      {/* Seção Inferior: Controles Ergonomicamente Posicionados (Bottom Sheet Style) */}
      <div className="flex-shrink-0 w-full max-w-sm mx-auto bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/5 p-6 mb-2 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
        
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
              Assistente Experimental da Fundação Seade
            </p>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
              PIESP · Análise de Investimentos
            </p>
          </div>

          <div className="flex flex-col w-full gap-3 pt-2">
            <button
              onClick={onNavigateToVoice}
              className="group relative flex items-center justify-center gap-3 w-full px-6 py-4 rounded-2xl bg-slate-800/50 hover:bg-rose-500/10 active:scale-95 border border-white/5 hover:border-rose-500/30 text-slate-200 transition-all duration-300 focus:outline-none shadow-lg overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500/0 via-rose-500/5 to-rose-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <SoundWaveIcon className="h-5 w-5 text-rose-500 group-hover:scale-110 transition-transform" />
              <span className="text-base font-semibold">Conversar por Voz</span>
            </button>
            
            <button
              onClick={onNavigateToChat}
              className="group flex items-center justify-center gap-3 w-full px-6 py-4 rounded-2xl bg-white/[0.03] hover:bg-sky-500/10 active:scale-95 border border-white/5 hover:border-sky-500/30 text-slate-300 transition-all duration-300 focus:outline-none text-base font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Abrir Chat de Texto</span>
            </button>
          </div>
        </div>

        {/* Versão discreta */}
        <div className="mt-6 pt-2 border-t border-white/[0.03] flex flex-col items-center gap-1.5">
          <div className="w-1 h-1 bg-rose-500/20 rounded-full" />
          <span className="text-[10px] text-slate-700 font-mono tracking-wider select-none">
            v{__APP_VERSION__}
          </span>
        </div>
      </div>

    </div>
  );
};

export default LandingPage;
