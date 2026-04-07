import React from 'react';
import { CloudArrowUpIcon } from './Icons';
import { ChatHeaderSphere } from './ChatHeaderSphere';

interface HeaderProps {
  onNavigateToDashboards?: () => void;
  onNavigateToMunicipal?: () => void;
  onNavigateToUpload?: () => void;
  onNavigateHome?: () => void;
  onNavigateToExplorar?: () => void;
  onNavigateToPerfilEmpresa?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigateToDashboards, onNavigateToMunicipal, onNavigateToUpload, onNavigateHome, onNavigateToExplorar, onNavigateToPerfilEmpresa }) => {
  return (
    <header className="flex-shrink-0 w-full max-w-7xl mx-auto px-6 py-4">
      <div className="grid grid-cols-3 items-center">
        {/* Left container: Logo and Home Link */}
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
        <nav className="hidden md:block justify-self-center">
          <ul className="flex items-center space-x-1 bg-slate-900/50 backdrop-blur-md rounded-full px-2 py-1.5 border border-white/5 shadow-xl">
             <li>
              <button 
                onClick={onNavigateHome}
                className="px-4 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-all"
              >
                Home
              </button>
            </li>
            <li>
              <button 
                onClick={onNavigateToDashboards}
                className="px-4 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-all whitespace-nowrap"
              >
                Dashboards
              </button>
            </li>
            <li>
              <button
                onClick={onNavigateToMunicipal}
                className="px-4 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-all whitespace-nowrap"
              >
                Municípios
              </button>
            </li>
            <li>
              <button
                onClick={onNavigateToExplorar}
                className="px-4 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-all whitespace-nowrap"
              >
                Explorar
              </button>
            </li>
            <li>
              <button
                onClick={onNavigateToPerfilEmpresa}
                className="px-4 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-all whitespace-nowrap"
              >
                Empresas
              </button>
            </li>
            <li className="ml-2 border-l border-white/10 pl-2">
               <button 
                onClick={onNavigateToUpload}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all whitespace-nowrap"
              >
                <CloudArrowUpIcon className="w-4 h-4" />
                Publicar
              </button>
            </li>
          </ul>
        </nav>

        {/* Right container */}
        <div className="justify-self-end flex items-center gap-4">
           <button className="p-2 text-slate-400 hover:text-white transition-colors">
             <span className="sr-only">Menu</span>
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
           </button>
        </div>
      </div>
    </header>
  );
};

export default Header;