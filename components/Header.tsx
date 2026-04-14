import React from 'react';
import { ChatHeaderSphere } from './ChatHeaderSphere';

interface HeaderProps {
  onNavigateHome?: () => void;
  onNavigateToChat?: () => void;
  onNavigateToVoice?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigateHome, onNavigateToChat, onNavigateToVoice }) => {
  return (
    <header className="flex-shrink-0 w-full max-w-7xl mx-auto px-6 py-4">
      <div className="grid grid-cols-3 items-center">
        {/* Left: Logo */}
        <div className="justify-self-start">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-3 group focus:outline-none"
            aria-label="Voltar para a página inicial"
          >
            <ChatHeaderSphere />
            <div className="flex flex-col items-start">
              <span className="font-bold text-white text-lg tracking-tight group-hover:text-rose-400 transition-colors">Nadia</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">AI Assistant</span>
            </div>
          </button>
        </div>

        {/* Navigation (centered) */}
        <nav className="justify-self-center">
          <ul className="flex items-center space-x-0.5 bg-slate-900/50 backdrop-blur-md rounded-full px-1.5 py-1 border border-white/5 shadow-xl">
            <li>
              <button
                onClick={onNavigateHome}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-all"
              >
                Home
              </button>
            </li>
            <li>
              <button
                onClick={onNavigateToChat}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-all"
              >
                Chat
              </button>
            </li>
            <li>
              <button
                onClick={onNavigateToVoice}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all"
              >
                Voz
              </button>
            </li>
          </ul>
        </nav>

        {/* Right: placeholder para alinhar grid */}
        <div className="justify-self-end" />
      </div>
    </header>
  );
};

export default Header;