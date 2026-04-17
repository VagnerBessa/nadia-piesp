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
      {/* Header fixo no topo — fora do main, sempre visível */}
      <Header
        activeView={view}
        onNavigateHome={handleNavigateHome}
        onNavigateToChat={handleNavigateToChat}
        onNavigateToVoice={handleNavigateToVoice}
      />
      <main className="flex-grow overflow-hidden flex flex-col">
        <Suspense fallback={<ViewLoader />}>
          {renderView()}
        </Suspense>
      </main>
      <footer className="flex-shrink-0 w-full py-5 px-6 z-50 flex items-center justify-center">
        <img 
          src="/images/logo-seade.png" 
          alt="Fundação Seade" 
          className="h-8 w-auto brightness-0 invert opacity-50 hover:opacity-70 transition-opacity duration-300"
        />
      </footer>
    </div>
  );
};

export default App;
