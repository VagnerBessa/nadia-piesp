import React, { useState, Suspense } from 'react';
import Header from './components/Header';

// Lazy loading: cada view é carregada apenas quando o usuário navegar até ela
const LandingPage       = React.lazy(() => import('./components/LandingPage'));
const VoiceView         = React.lazy(() => import('./components/VoiceView'));
const ChatView          = React.lazy(() => import('./components/ChatView'));
const PiespDashboardView = React.lazy(() => import('./components/PiespDashboardView'));
const PerfilMunicipalView = React.lazy(() => import('./components/PerfilMunicipalView'));
const UploadView        = React.lazy(() => import('./components/UploadView'));
const ExplorarDadosView = React.lazy(() => import('./components/ExplorarDadosView'));
const PerfilEmpresaView = React.lazy(() => import('./components/PerfilEmpresaView'));
const DataLabView       = React.lazy(() => import('./components/DataLabView'));

type View = 'home' | 'voice' | 'chat' | 'dashboards' | 'municipal' | 'upload' | 'explorar' | 'perfil-empresa' | 'datalab';

// Fallback minimalista enquanto o chunk da view carrega
const ViewLoader = () => (
  <div className="flex-grow flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-rose-500/40 border-t-rose-500 rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');

  const handleNavigateToVoice        = () => setView('voice');
  const handleNavigateToChat         = () => setView('chat');
  const handleNavigateHome           = () => setView('home');
  const handleNavigateToDashboards   = () => setView('dashboards');
  const handleNavigateToMunicipal    = () => setView('municipal');
  const handleNavigateToExplorar     = () => setView('explorar');
  const handleNavigateToPerfilEmpresa = () => setView('perfil-empresa');
  const handleNavigateToDataLab      = () => setView('datalab');

  const renderView = () => {
    switch (view) {
      case 'voice':         return <VoiceView onNavigateHome={handleNavigateHome} />;
      case 'chat':          return <ChatView onNavigateHome={handleNavigateHome} />;
      case 'dashboards':    return <PiespDashboardView onNavigateHome={handleNavigateHome} />;
      case 'municipal':     return <PerfilMunicipalView onNavigateHome={handleNavigateHome} />;
      case 'upload':        return <UploadView onNavigateHome={handleNavigateHome} />;
      case 'explorar':      return <ExplorarDadosView onNavigateHome={handleNavigateHome} />;
      case 'perfil-empresa': return <PerfilEmpresaView onNavigateHome={handleNavigateHome} />;
      case 'datalab':       return <DataLabView onNavigateHome={handleNavigateHome} />;
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
        onNavigateToDashboards={handleNavigateToDashboards}
        onNavigateToMunicipal={handleNavigateToMunicipal}

        onNavigateHome={handleNavigateHome}
        onNavigateToExplorar={handleNavigateToExplorar}
        onNavigateToPerfilEmpresa={handleNavigateToPerfilEmpresa}
        onNavigateToDataLab={handleNavigateToDataLab}
      />
      <main className="flex-grow relative overflow-hidden flex flex-col">
        <Suspense fallback={<ViewLoader />}>
          {renderView()}
        </Suspense>
      </main>
      <footer className="flex-shrink-0 w-full py-1.5 px-4 text-center bg-slate-950/40 backdrop-blur-md border-t border-white/5 z-50">
        <p className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-wide">
          A Nadia pode apresentar falhas. Para validação oficial, contate a <a href="https://seade.gov.br" target="_blank" rel="noopener noreferrer" className="hover:text-rose-400 transition-colors underline decoration-slate-700/50">Fundação Seade</a>.
        </p>
      </footer>
    </div>
  );
};

export default App;
