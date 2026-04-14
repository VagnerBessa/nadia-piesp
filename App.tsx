import React, { useState, Suspense } from 'react';
import Header from './components/Header';

// Mobile: apenas as três views conversacionais
const LandingPage = React.lazy(() => import('./components/LandingPage'));
const VoiceView   = React.lazy(() => import('./components/VoiceView'));
const ChatView    = React.lazy(() => import('./components/ChatView'));

type View = 'home' | 'voice' | 'chat';

const ViewLoader = () => (
  <div className="flex-grow flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-rose-500/40 border-t-rose-500 rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');

  const handleNavigateHome    = () => setView('home');
  const handleNavigateToVoice = () => setView('voice');
  const handleNavigateToChat  = () => setView('chat');

  const renderView = () => {
    switch (view) {
      case 'voice': return <VoiceView onNavigateHome={handleNavigateHome} />;
      case 'chat':  return <ChatView onNavigateHome={handleNavigateHome} />;
      case 'home':
      default:
        return (
          <LandingPage
            onNavigateToVoice={handleNavigateToVoice}
            onNavigateToChat={handleNavigateToChat}
          />
        );
    }
  };

  return (
    <div className="h-screen w-screen bg-transparent text-white font-sans flex flex-col overflow-hidden">
      <Header
        onNavigateHome={handleNavigateHome}
        onNavigateToChat={handleNavigateToChat}
        onNavigateToVoice={handleNavigateToVoice}
      />
      <main className="flex-grow relative overflow-hidden flex flex-col">
        <Suspense fallback={<ViewLoader />}>
          {renderView()}
        </Suspense>
      </main>
      <footer className="flex-shrink-0 w-full py-1.5 px-4 text-center bg-slate-950/40 backdrop-blur-md border-t border-white/5 z-50">
        <p className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-wide">
          A Nadia pode apresentar falhas. Para validação oficial, contate a{' '}
          <a href="https://seade.gov.br" target="_blank" rel="noopener noreferrer" className="hover:text-rose-400 transition-colors underline decoration-slate-700/50">
            Fundação Seade
          </a>.
        </p>
      </footer>
    </div>
  );
};

export default App;
