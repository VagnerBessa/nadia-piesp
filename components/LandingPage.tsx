import React from 'react';
import SoundWaveIcon from './SoundWaveIcon';
import { NadiaSphere } from './NadiaSphere';
import { NadiaCapivara } from './NadiaCapivara';

interface LandingPageProps {
  onNavigateToVoice: () => void;
  onNavigateToChat: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToVoice, onNavigateToChat }) => {
  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full p-4 sm:p-6">
       <main className="flex flex-col-reverse md:flex-row items-center justify-center md:justify-between gap-12 md:gap-16 w-full max-w-6xl mx-auto">
        
        {/* Left Column: Text content and actions */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left max-w-xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight">
            Nadia - Núcleo de Análise de Dados e Inteligência Artificial
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Projeto experimental da gerência de economia da Fundação Seade
          </p>

          <p className="mt-8 text-slate-400">Selecione o modo de interação:</p>
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={onNavigateToVoice}
              className="flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-slate-800/70 hover:bg-slate-700/90 border border-slate-700 text-slate-200 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-500 backdrop-blur-sm shadow-lg text-lg w-64"
            >
              <SoundWaveIcon className="h-6 w-6 text-rose-400" />
              <span>Conversar por Voz</span>
            </button>
            <button
              onClick={onNavigateToChat}
              className="flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-slate-800/70 hover:bg-slate-700/90 border border-slate-700 text-slate-200 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-500 backdrop-blur-sm shadow-lg text-lg w-64"
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Abrir Chat</span>
            </button>
          </div>
        </div>

        {/* Right Column: Nadia Sphere + Capivara mascote */}
        <div className="flex-shrink-0 flex flex-col items-center gap-4">
           <NadiaSphere isListening={false} isSpeaking={false} isConnecting={false} audioLevel={0} />
           <NadiaCapivara size={128} state="idle" className="opacity-80 hover:opacity-100 transition-opacity duration-300" />
        </div>

      </main>
      
      <footer className="absolute bottom-4 left-0 right-0 flex flex-col items-center justify-center gap-y-2 px-4">
          <p className="font-bold text-white text-base">Fundação Seade</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-x-4 gap-y-1 text-sm text-slate-300 text-center">
            <span>Laboratório de Inteligência Artificial</span>
            <span className="hidden sm:inline">|</span>
            <span>Centro de Ciência de Dados para Políticas Públicas - CCDEP</span>
          </div>
      </footer>
    </div>
  );
};

export default LandingPage;