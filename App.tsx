import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import VoiceView from './components/VoiceView';
import ChatView from './components/ChatView';
import PibMensalView from './components/PibMensalView';
import SeadeEmpresasView from './components/SeadeEmpresasView';
import PerfilMunicipalView from './components/PerfilMunicipalView';
import ProjecaoView from './components/ProjecaoView';
import UploadView from './components/UploadView';
import Header from './components/Header';

type View = 'home' | 'voice' | 'chat' | 'pib' | 'empresas' | 'municipal' | 'projecoes' | 'upload';

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');

  const handleNavigateToVoice = () => setView('voice');
  const handleNavigateToChat = () => setView('chat');
  const handleNavigateHome = () => setView('home');
  const handleNavigateToPib = () => setView('pib');
  const handleNavigateToEmpresas = () => setView('empresas');
  const handleNavigateToMunicipal = () => setView('municipal');
  const handleNavigateToProjecoes = () => setView('projecoes');
  const handleNavigateToUpload = () => setView('upload');

  const renderView = () => {
    switch (view) {
      case 'voice':
        return <VoiceView onNavigateHome={handleNavigateHome} />;
      case 'chat':
        return <ChatView onNavigateHome={handleNavigateHome} />;
      case 'pib':
        return <PibMensalView onNavigateHome={handleNavigateHome} />;
      case 'empresas':
        return <SeadeEmpresasView onNavigateHome={handleNavigateHome} />;
      case 'municipal':
        return <PerfilMunicipalView onNavigateHome={handleNavigateHome} />;
      case 'projecoes':
        return <ProjecaoView onNavigateHome={handleNavigateHome} />;
      case 'upload':
        return <UploadView onNavigateHome={handleNavigateHome} />;
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
        onNavigateToPib={handleNavigateToPib} 
        onNavigateToEmpresas={handleNavigateToEmpresas}
        onNavigateToMunicipal={handleNavigateToMunicipal}
        onNavigateToProjecoes={handleNavigateToProjecoes}
        onNavigateToUpload={handleNavigateToUpload}
        onNavigateHome={handleNavigateHome} 
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