import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import VoiceView from './components/VoiceView';
import ChatView from './components/ChatView';
import PiespDashboardView from './components/PiespDashboardView';
import PerfilMunicipalView from './components/PerfilMunicipalView';
import UploadView from './components/UploadView';
import ExplorarDadosView from './components/ExplorarDadosView';
import PerfilEmpresaView from './components/PerfilEmpresaView';
import Header from './components/Header';

type View = 'home' | 'voice' | 'chat' | 'dashboards' | 'municipal' | 'upload' | 'explorar' | 'perfil-empresa';

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');

  const handleNavigateToVoice = () => setView('voice');
  const handleNavigateToChat = () => setView('chat');
  const handleNavigateHome = () => setView('home');
  const handleNavigateToDashboards = () => setView('dashboards');
  const handleNavigateToMunicipal = () => setView('municipal');
  const handleNavigateToUpload = () => setView('upload');
  const handleNavigateToExplorar = () => setView('explorar');
  const handleNavigateToPerfilEmpresa = () => setView('perfil-empresa');

  const renderView = () => {
    switch (view) {
      case 'voice':
        return <VoiceView onNavigateHome={handleNavigateHome} />;
      case 'chat':
        return <ChatView onNavigateHome={handleNavigateHome} />;
      case 'dashboards':
        return <PiespDashboardView onNavigateHome={handleNavigateHome} />;
      case 'municipal':
        return <PerfilMunicipalView onNavigateHome={handleNavigateHome} />;
      case 'upload':
        return <UploadView onNavigateHome={handleNavigateHome} />;
      case 'explorar':
        return <ExplorarDadosView onNavigateHome={handleNavigateHome} />;
      case 'perfil-empresa':
        return <PerfilEmpresaView onNavigateHome={handleNavigateHome} />;
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
        onNavigateToUpload={handleNavigateToUpload}
        onNavigateHome={handleNavigateHome}
        onNavigateToExplorar={handleNavigateToExplorar}
        onNavigateToPerfilEmpresa={handleNavigateToPerfilEmpresa}
      />
      <main className="flex-grow relative overflow-hidden flex flex-col">
        {renderView()}
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