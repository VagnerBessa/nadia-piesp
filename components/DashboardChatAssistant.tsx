import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ChatHeaderSphere } from './ChatHeaderSphere';
import { SmallNadiaSphere } from './SmallNadiaSphere';
import { SendIcon } from './Icons';

interface DashboardChatAssistantProps {
  onClose: () => void;
  dataContext: any;
  className?: string; // Allow overriding position
}

const DashboardChatAssistant: React.FC<DashboardChatAssistantProps> = ({ onClose, dataContext, className }) => {
  const { messages, sendMessage, isLoading } = useChat();
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Initialize context
  useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);
    }
  }, [hasInitialized]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    // We prepend the context to the user's message invisibly
    const contextString = `[CONTEXTO DO DASHBOARD ATUAL: ${JSON.stringify(dataContext)}]`;
    const fullMessage = `${contextString}\n\nPergunta do usuário: ${inputValue}`;
    
    sendMessage(fullMessage);
    setInputValue('');
  };

  // Default position if className is not provided, otherwise use className
  const containerClasses = className || "absolute top-[280px] right-[40px] z-[1201]";

  return (
    <div className={`${containerClasses} w-96 h-[400px] bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-10 duration-300`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
            <div className="flex items-center gap-3">
                <ChatHeaderSphere />
                <div>
                    <h3 className="text-sm font-bold text-white">Nadia Analytics</h3>
                    <p className="text-xs text-slate-400">Vendo dados do painel</p>
                </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        {/* Messages */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
             {/* Intro Message */}
             <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1"><SmallNadiaSphere /></div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 shadow-sm">
                    Estou analisando os dados do PIB deste painel. Posso explicar a queda de 0,3% em agosto ou detalhar o desempenho por setor. O que gostaria de saber?
                </div>
            </div>

            {messages.slice(1).map((msg, idx) => (
                <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.role === 'model' && <div className="flex-shrink-0 mt-1"><SmallNadiaSphere /></div>}
                    <div 
                        className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                            msg.role === 'user' 
                            ? 'bg-rose-600 text-white rounded-tr-none' 
                            : 'bg-slate-800 text-slate-200 rounded-tl-none'
                        }`}
                    >
                        {/* We filter out the context string from display if it exists */}
                        <MarkdownRenderer content={msg.text.replace(/\[CONTEXTO.*?\]\s*Pergunta do usuário:\s*/, '')} />
                    </div>
                </div>
            ))}
             {isLoading && (
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1"><SmallNadiaSphere /></div>
                    <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-400 animate-pulse">
                        Analisando dados...
                    </div>
                </div>
            )}
        </div>

        {/* Input */}
        <div className="p-3 bg-slate-900 border-t border-slate-800">
            <div className="flex items-center gap-2 bg-slate-800 rounded-full px-4 py-2 border border-slate-700 focus-within:border-rose-500 transition-colors">
                <input 
                    type="text" 
                    className="flex-grow bg-transparent outline-none text-sm text-white placeholder-slate-500"
                    placeholder="Pergunte sobre o gráfico..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={isLoading}
                    autoFocus
                />
                <button 
                    onClick={handleSend}
                    disabled={isLoading || !inputValue.trim()}
                    className="text-rose-500 disabled:text-slate-600 hover:text-rose-400 transition-colors"
                >
                    <SendIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    </div>
  );
};

export default DashboardChatAssistant;