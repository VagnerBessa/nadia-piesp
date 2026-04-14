import React from 'react';
import SoundWaveIcon from './SoundWaveIcon';
import { NadiaSphere } from './NadiaSphere';

interface LandingPageProps {
  onNavigateToVoice: () => void;
  onNavigateToChat: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToVoice, onNavigateToChat }) => {
  return (
    <div className="flex flex-col items-center justify-between w-full h-full px-6 py-8 overflow-y-auto">

      {/* Esfera — size="small" garante shader e container proporcionais */}
      <div className="flex-shrink-0 mt-2">
        <NadiaSphere isListening={false} isSpeaking={false} isConnecting={false} audioLevel={0} size="small" />
      </div>

      {/* Conteúdo central */}
      <div className="flex flex-col items-center text-center flex-grow justify-center gap-4 py-6 max-w-sm w-full">
        <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
          Nadia
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Núcleo de Análise de Dados e Inteligência Artificial — Projeto experimental da Fundação Seade
        </p>

        <p className="text-xs text-slate-500 mt-2">Selecione o modo de interação:</p>

        <div className="flex flex-col w-full gap-3 mt-1">
          <button
            onClick={onNavigateToVoice}
            className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-2xl bg-slate-800/70 hover:bg-slate-700/90 active:scale-95 border border-slate-700 text-slate-200 transition-all duration-200 focus:outline-none backdrop-blur-sm shadow-lg text-base font-medium"
          >
            <SoundWaveIcon className="h-5 w-5 text-rose-400" />
            <span>Conversar por Voz</span>
          </button>
          <button
            onClick={onNavigateToChat}
            className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-2xl bg-slate-800/70 hover:bg-slate-700/90 active:scale-95 border border-slate-700 text-slate-200 transition-all duration-200 focus:outline-none backdrop-blur-sm shadow-lg text-base font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>Abrir Chat</span>
          </button>
        </div>
      </div>

      {/* Footer fixo no fundo — não sobrepõe conteúdo */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1 pb-2">
        <p className="font-semibold text-white text-sm">Fundação Seade</p>
        <p className="text-xs text-slate-400 text-center">Laboratório de IA · CCDEP</p>
      </div>

    </div>
  );
};

export default LandingPage;
