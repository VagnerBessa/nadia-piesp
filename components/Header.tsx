import React from 'react';
import { ChatHeaderSphere } from './ChatHeaderSphere';

interface HeaderProps {
  onNavigateHome?: () => void;
  onNavigateToChat?: () => void;
  onNavigateToVoice?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigateHome, onNavigateToChat, onNavigateToVoice }) => {
  return (
    <header className="flex-shrink-0 w-full px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        {/* Logo */}
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2 group focus:outline-none flex-shrink-0"
          aria-label="Voltar para a página inicial"
        >
          <ChatHeaderSphere />
          <div className="flex flex-col items-start">
            <span className="font-bold text-white text-base tracking-tight group-hover:text-rose-400 transition-colors">Nadia</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest">AI Assistant</span>
          </div>
        </button>

        {/* Navigation */}
        <nav>
          <ul className="flex items-center space-x-0.5 bg-slate-900/60 backdrop-blur-md rounded-full px-1.5 py-1 border border-white/5 shadow-xl">
            <li>
              <button
                onClick={onNavigateHome}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 rounded-full transition-all"
              >
                Home
              </button>
            </li>
            <li>
              <button
                onClick={onNavigateToChat}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 rounded-full transition-all"
              >
                Chat
              </button>
            </li>
            <li>
              <button
                onClick={onNavigateToVoice}
                className="px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 active:bg-rose-500/20 rounded-full transition-all"
              >
                Voz
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;