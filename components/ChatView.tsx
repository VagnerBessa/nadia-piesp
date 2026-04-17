import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useChat, ResponseMode } from '../hooks/useChat';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useAutoResizeTextArea } from '../hooks/useAutoResizeTextArea';
import { SmallNadiaSphere } from './SmallNadiaSphere';
import { SendIcon, SwitchModeIcon } from './Icons';
import SoundWaveIcon from './SoundWaveIcon';
import { ChatHeaderSphere } from './ChatHeaderSphere';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatViewProps {
  onNavigateHome: () => void;
}

interface AgentConfig {
  name: string;
  label: string;
  icon: React.ReactNode;
}

// Ícones SVG inline — estilo outline, 20×20
const Icons = {
  Briefcase: () => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="3" y="7" width="14" height="11" rx="2" />
      <path d="M7 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
      <line x1="3" y1="12" x2="17" y2="12" />
    </svg>
  ),
  GraduationCap: () => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M10 2L2 7l8 5 8-5-8-5z" />
      <path d="M2 7v5c0 2.5 3.6 4 8 4s8-1.5 8-4V7" />
    </svg>
  ),
  Truck: () => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="1" y="5" width="12" height="9" rx="1" />
      <path d="M13 9h4l2 3v3h-6V9z" />
      <circle cx="5" cy="16" r="1.5" />
      <circle cx="15" cy="16" r="1.5" />
    </svg>
  ),
  Lightbulb: () => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M10 2a6 6 0 016 6c0 2.5-1.5 4.5-3 5.5V15H7v-1.5C5.5 12.5 4 10.5 4 8a6 6 0 016-6z" />
      <line x1="7" y1="17" x2="13" y2="17" />
      <line x1="8" y1="19" x2="12" y2="19" />
    </svg>
  ),
  MapPin: () => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M10 2a6 6 0 016 6c0 4-6 10-6 10S4 12 4 8a6 6 0 016-6z" />
      <circle cx="10" cy="8" r="2" />
    </svg>
  ),
  Network: () => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="10" cy="10" r="2" />
      <circle cx="3" cy="5" r="1.5" />
      <circle cx="17" cy="5" r="1.5" />
      <circle cx="3" cy="15" r="1.5" />
      <circle cx="17" cy="15" r="1.5" />
      <line x1="8" y1="9" x2="4.5" y2="6" />
      <line x1="12" y1="9" x2="15.5" y2="6" />
      <line x1="8" y1="11" x2="4.5" y2="14" />
      <line x1="12" y1="11" x2="15.5" y2="14" />
    </svg>
  ),
  Leaf: () => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M17 3C9 3 4 9 4 16" />
      <path d="M17 3C17 3 17 11 10 14c-3 1.3-6 2-6 2" />
      <line x1="4" y1="16" x2="10" y2="10" />
    </svg>
  ),
  Globe: () => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="10" cy="10" r="8" />
      <path d="M2 10h16" />
      <path d="M10 2a14 14 0 014 8 14 14 0 01-4 8 14 14 0 01-4-8 14 14 0 014-8z" />
    </svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-50">
      <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" clipRule="evenodd" />
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5">
      <path d="M2.22 2.22a.75.75 0 011.06 0L6 4.94l2.72-2.72a.75.75 0 111.06 1.06L7.06 6l2.72 2.72a.75.75 0 11-1.06 1.06L6 7.06 3.28 9.78a.75.75 0 01-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 010-1.06z" />
    </svg>
  ),
};

const AGENTS: AgentConfig[] = [
  { name: 'emprego_empregabilidade',   label: 'Emprego e Empregabilidade',  icon: <Icons.Briefcase /> },
  { name: 'qualificacao_profissional', label: 'Qualificação Profissional',   icon: <Icons.GraduationCap /> },
  { name: 'logistica_infraestrutura',  label: 'Logística e Infraestrutura', icon: <Icons.Truck /> },
  { name: 'inovacao_tecnologia',       label: 'Inovação e Tecnologia',      icon: <Icons.Lightbulb /> },
  { name: 'desenvolvimento_regional',  label: 'Desenvolvimento Regional',   icon: <Icons.MapPin /> },
  { name: 'cadeias_produtivas',        label: 'Cadeias Produtivas',         icon: <Icons.Network /> },
  { name: 'transicao_energetica',      label: 'Transição Energética',       icon: <Icons.Leaf /> },
  { name: 'comercio_exterior',         label: 'Comércio Exterior',          icon: <Icons.Globe /> },
];

const ChatView: React.FC<ChatViewProps> = ({ onNavigateHome }) => {
  const [activeAgent, setActiveAgent] = useState<AgentConfig | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { messages, sendMessage, isLoading } = useChat({ selectedSkillName: activeAgent?.name });
  const { text: speechText, startListening, stopListening, isListening, hasRecognitionSupport } = useSpeechRecognition();
  const [inputValue, setInputValue] = useState('');
  const [responseMode, setResponseMode] = useState<ResponseMode>('complete');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const prevIsListening = useRef(isListening);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottom = useRef(true);

  useAutoResizeTextArea(textAreaRef.current, inputValue);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setPickerOpen(false);
      }
    };
    if (pickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  const handleSend = useCallback(() => {
    const textToSend = inputValue.trim();
    if (textToSend && !isLoading) {
      sendMessage(textToSend, responseMode);
      setInputValue('');
      setChatStarted(true);
      if (isListening) stopListening();
    }
  }, [inputValue, isLoading, isListening, sendMessage, stopListening, responseMode]);

  useEffect(() => {
    if (speechText) setInputValue(speechText);
  }, [speechText]);

  useEffect(() => {
    if (prevIsListening.current && !isListening && inputValue.trim()) handleSend();
    prevIsListening.current = isListening;
  }, [isListening, inputValue, handleSend]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 10;
      shouldStickToBottom.current = isAtBottom;
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useLayoutEffect(() => {
    if (shouldStickToBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleMicClick = () => {
    if (isListening) stopListening();
    else { setInputValue(''); startListening(); }
  };

  const handleSelectAgent = (agent: AgentConfig | null) => {
    setActiveAgent(agent);
    setPickerOpen(false);
  };

  // Caixa de input — reutilizada nos dois estados (centrada e bottom)
  const InputBox = (
    <div className="relative w-full">
      {/* Dropdown de agentes — abre para baixo */}
      {pickerOpen && (
        <div
          ref={pickerRef}
          className="xl:hidden absolute bottom-full left-0 mb-3 w-64 rounded-2xl border border-slate-700 bg-slate-900 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-50 flex flex-col"
          style={{ animation: 'dropdown-in 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
        >
          {/* Opção fixa no topo */}
          <div className="flex-shrink-0">
            <button
              onClick={() => handleSelectAgent(null)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-slate-800 transition-colors rounded-t-2xl"
            >
              <span className={`${activeAgent === null ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                Geral
              </span>
              {activeAgent === null && <span className="text-rose-500"><Icons.Check /></span>}
            </button>
            <div className="border-t border-slate-800 mx-3" />
          </div>
          {/* Lista com scroll */}
          <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '260px' }}>
          {AGENTS.map(agent => {
            const isActive = activeAgent?.name === agent.name;
            return (
              <button
                key={agent.name}
                onClick={() => handleSelectAgent(agent)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-slate-800 transition-colors gap-3"
              >
                <span className={`flex items-center gap-3 ${isActive ? 'text-rose-400' : 'text-slate-400'}`}>
                  <span className={isActive ? 'text-rose-500' : 'text-slate-500'}>
                    {agent.icon}
                  </span>
                  <span className={isActive ? 'font-medium' : ''}>{agent.label}</span>
                </span>
                {isActive && <span className="text-rose-500 flex-shrink-0"><Icons.Check /></span>}
              </button>
            );
          })}
          </div>
        </div>
      )}

      {/* Caixa */}
      <div className={`bg-slate-800/60 rounded-2xl border transition-colors duration-200 overflow-hidden ${
        pickerOpen ? 'border-slate-600' : 'border-slate-700 focus-within:border-rose-500/70'
      }`}>

        {/* Badge de agente ativo */}
        {activeAgent && (
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              <span className="text-rose-500">{activeAgent.icon}</span>
              {activeAgent.label}
              <button
                onClick={() => setActiveAgent(null)}
                className="ml-0.5 text-rose-500/50 hover:text-rose-400 transition-colors"
              >
                <Icons.Close />
              </button>
            </span>
          </div>
        )}

        {/* Textarea */}
        <div className="flex items-end gap-2 px-4 pt-4 pb-2">
          <textarea
            ref={textAreaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={isListening ? 'Ouvindo...' : 'Digite sua mensagem...'}
            rows={1}
            className="flex-grow bg-transparent text-slate-200 placeholder-slate-400 focus:outline-none resize-none custom-scrollbar py-2 text-base min-h-[40px]"
            disabled={isLoading}
          />
          {hasRecognitionSupport && (
            <button
              onClick={handleMicClick}
              disabled={isLoading}
              className={`flex-shrink-0 p-1.5 rounded-full transition-colors ${
                isListening ? 'bg-rose-500/20 text-rose-500' : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              <SoundWaveIcon className="w-5 h-5" isListening={isListening} />
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
            className="flex-shrink-0 p-1.5 rounded-full bg-rose-500 text-white disabled:bg-slate-700 disabled:cursor-not-allowed hover:bg-rose-400 transition-colors"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Barra inferior: Agentes + Modo */}
        <div className="flex items-center justify-between px-2 pb-2 gap-2">
          <button
            ref={triggerRef}
            onClick={() => setPickerOpen(p => !p)}
            className={`xl:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
              activeAgent
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                : pickerOpen
                  ? 'bg-slate-700 text-slate-200 border border-slate-600'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <Icons.ChevronDown />
            <span>Agentes</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Modo:</span>
            <div className="flex items-center bg-slate-800 rounded-full p-0.5 border border-slate-700 text-xs">
              <button
                onClick={() => setResponseMode('fast')}
                className={`px-2.5 py-0.5 rounded-full transition-colors ${
                  responseMode === 'fast' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Rápido
              </button>
              <button
                onClick={() => setResponseMode('complete')}
                className={`px-2.5 py-0.5 rounded-full transition-colors ${
                  responseMode === 'complete' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Completo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #64748b; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #475569 transparent; }
        @keyframes dropdown-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Layout: left spacer | chat column | agent sidebar */}
      <div className="w-full h-full flex">

        {/* Left spacer — mirrors sidebar width on XL to keep chat centered */}
        <div className="hidden xl:block xl:w-56 flex-shrink-0" />

        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0 max-w-3xl bg-transparent">


          {!chatStarted ? (
            /* Estado inicial — Foco central e input na base */
            <div className="flex-grow flex flex-col items-center px-6 pt-[8%] pb-8 overflow-y-auto">
              
              <div className="flex flex-col items-center text-center mb-10 animate-in fade-in zoom-in duration-1000">
                {/* Marca Nadia — identidade visual consistente com as demais telas */}
                <div className="flex flex-col items-center mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tighter leading-none mb-2">
                    Nadia
                  </h1>
                  <div className="h-0.5 w-10 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                </div>

                <div className="relative mb-5">
                  <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full" />
                  <ChatHeaderSphere size={120} />
                </div>
                <h2 className="text-lg font-semibold text-white mb-2 tracking-tight">Como posso ajudar hoje?</h2>
                <p className="text-sm text-slate-400 max-w-[280px] leading-relaxed">
                  Explore os dados do PIESP com a Nadia e obtenha insights instantâneos.
                </p>
              </div>

              {/* Action Chips: Preenchendo o vácuo com utilidade */}
              <div className="w-full max-w-lg mb-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 text-center">Sugestões de Consulta</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "Mostre os investimentos confirmados no município de Campinas",
                    "Há algum projeto de transição energética ou sustentabilidade anunciado?",
                    "Quais investimentos em logística estão previstos na Baixada Santista?"
                  ].map((sugestao) => (
                    <button
                      key={sugestao}
                      onClick={() => {
                        setInputValue(sugestao);
                        // Pequeno delay para efeito visual antes de enviar
                        setTimeout(() => handleSend(), 150);
                      }}
                      className="px-4 py-2 rounded-full bg-slate-800/40 border border-white/5 text-slate-300 text-xs font-medium hover:bg-rose-500/10 hover:border-rose-500/30 transition-all active:scale-95"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input fixo na base (ergonômico) */}
              <div className="w-full max-w-2xl mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
                {InputBox}
              </div>
            </div>
          ) : (
            /* Estado de chat — mensagens + input no rodapé */
            <>
              {/* Mini marca Nadia — sempre visível no topo do chat ativo */}
              <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-2 border-b border-white/[0.05]">
                <ChatHeaderSphere size={28} />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-white tracking-tight leading-none">Nadia</span>
                  <div className="h-0.5 w-5 bg-rose-500 rounded-full shadow-[0_0_6px_rgba(244,63,94,0.5)]" />
                </div>
              </div>
              <main ref={scrollContainerRef} className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-6">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'model' && <div className="flex-shrink-0"><ChatHeaderSphere /></div>}
                    <div className={`max-w-xl rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-rose-500 text-white rounded-br-none shadow-[0_4px_12px_rgba(244,63,94,0.2)]'
                        : 'bg-slate-700 text-slate-200 rounded-bl-none'
                    }`}>
                      <MarkdownRenderer content={msg.text} />
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-600">
                          <h4 className="text-xs font-semibold text-slate-400 mb-1.5">Fontes:</h4>
                          <ul className="text-xs space-y-1">
                            {msg.sources.map((source, i) => (
                              <li key={i}>
                                <a href={source.uri} target="_blank" rel="noopener noreferrer"
                                  className="text-sky-400 hover:text-sky-300 hover:underline truncate block">
                                  {source.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0"><ChatHeaderSphere /></div>
                    <div className="max-w-xl rounded-2xl px-4 py-3 bg-slate-700 text-slate-200 rounded-bl-none flex items-center gap-2">
                      <SmallNadiaSphere />
                      <span className="text-slate-400 animate-pulse">Pensando...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </main>

              <footer className="flex-shrink-0 px-4 pt-3 pb-safe border-t border-slate-700/50">
                {InputBox}
              </footer>
            </>
          )}
        </div>

        {/* Agent sidebar — desktop only (XL+), uses negative space outside max-w-3xl */}
        <aside className="hidden xl:flex flex-col w-56 flex-shrink-0 border-l border-slate-800/60 pt-6 px-4 overflow-y-auto custom-scrollbar">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-4 px-1">
            Agente Ativo
          </p>

          {/* Geral */}
          <button
            onClick={() => handleSelectAgent(null)}
            className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm text-left transition-all duration-150 mb-1 ${
              activeAgent === null
                ? 'bg-slate-800 text-slate-100 border border-slate-600/60'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
              activeAgent === null ? 'bg-slate-300' : 'bg-slate-700'
            }`} />
            <span className={activeAgent === null ? 'font-medium' : ''}>Geral</span>
          </button>

          <div className="border-t border-slate-800 my-3" />

          {/* Agent list */}
          <div className="flex flex-col gap-0.5">
            {AGENTS.map(agent => {
              const isActive = activeAgent?.name === agent.name;
              return (
                <button
                  key={agent.name}
                  onClick={() => handleSelectAgent(isActive ? null : agent)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm text-left transition-all duration-150 border ${
                    isActive
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border-transparent'
                  }`}
                >
                  <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-rose-500' : 'text-slate-600'}`}>
                    {agent.icon}
                  </span>
                  <span className={`leading-snug ${isActive ? 'font-medium' : ''}`}>{agent.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

      </div>
    </>
  );
};

export default ChatView;
