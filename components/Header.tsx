import React from 'react';

type View = 'home' | 'voice' | 'chat';

interface HeaderProps {
  activeView: View;
  onNavigateHome?: () => void;
  onNavigateToChat?: () => void;
  onNavigateToVoice?: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeView, onNavigateHome, onNavigateToChat, onNavigateToVoice }) => {
  // Ative state: solid white text + subtle frosted background pill
  const activeClass = 'px-3.5 py-1.5 text-xs font-semibold text-white bg-white/[0.10] rounded-full transition-all duration-200';
  // Inactive state: muted, becomes white on hover
  const inactiveClass = 'px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-full transition-all duration-200';
  // Voz: always accented in rose, brighter when active
  const vozActiveClass  = 'px-3.5 py-1.5 text-xs font-semibold text-rose-300 bg-rose-500/[0.15] rounded-full transition-all duration-200';
  const vozInactiveClass = 'px-3.5 py-1.5 text-xs font-medium text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/[0.10] rounded-full transition-all duration-200';

  return (
    <header className="flex-shrink-0 w-full px-4 py-2.5">
      <div className="flex items-center justify-between gap-2">

        {/* SP Gov Brand — top left */}
        <button
          onClick={onNavigateHome}
          className="flex items-center group focus:outline-none flex-shrink-0"
          aria-label="Voltar para a página inicial"
        >
          <img
            src="/images/logo-sp.png"
            alt="Governo do Estado de São Paulo"
            className="h-8 w-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
          />
        </button>

        {/* Navigation pill */}
        <nav aria-label="Navegação principal">
          <ul className="flex items-center space-x-0.5 bg-slate-900/50 backdrop-blur-xl rounded-full px-1.5 py-1 border border-white/[0.07] shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <li>
              <button
                onClick={onNavigateHome}
                aria-current={activeView === 'home' ? 'page' : undefined}
                className={activeView === 'home' ? activeClass : inactiveClass}
              >
                Home
              </button>
            </li>
            <li>
              <button
                onClick={onNavigateToChat}
                aria-current={activeView === 'chat' ? 'page' : undefined}
                className={activeView === 'chat' ? activeClass : inactiveClass}
              >
                Chat
              </button>
            </li>
            <li>
              <button
                onClick={onNavigateToVoice}
                aria-current={activeView === 'voice' ? 'page' : undefined}
                className={activeView === 'voice' ? vozActiveClass : vozInactiveClass}
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