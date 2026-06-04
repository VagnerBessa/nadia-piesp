import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useAutoResizeTextArea } from '../hooks/useAutoResizeTextArea';
import { SmallNadiaSphere } from './SmallNadiaSphere';
import { SendIcon } from './Icons';
import SoundWaveIcon from './SoundWaveIcon';
import { ChatHeaderSphere } from './ChatHeaderSphere';
import { MarkdownRenderer } from './MarkdownRenderer';


interface ChatViewProps {
  onNavigateHome: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({ onNavigateHome: _onNavigateHome }) => {
  const [chatStarted, setChatStarted] = useState(false);

  const { messages, sendMessage, isLoading, streamingText, streamingComplete } = useChat();
  const { text: speechText, startListening, stopListening, isListening, hasRecognitionSupport } = useSpeechRecognition();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const prevIsListening = useRef(isListening);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottom = useRef(true);

  // Animação palavra-a-palavra com setInterval — velocidade constante independente do tamanho dos chunks
  const [displayText, setDisplayText] = useState('');
  const streamQueueRef = useRef('');
  const prevStreamLenRef = useRef(0);
  const drainIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref sincronizado com streamingComplete para uso dentro do callback do setInterval
  const streamingCompleteRef = useRef(false);
  streamingCompleteRef.current = streamingComplete;

  const stopDrain = useCallback(() => {
    if (drainIntervalRef.current !== null) {
      clearInterval(drainIntervalRef.current);
      drainIntervalRef.current = null;
    }
  }, []);

  const startDrain = useCallback(() => {
    if (drainIntervalRef.current !== null) return;
    drainIntervalRef.current = setInterval(() => {
      const queue = streamQueueRef.current;
      if (!queue) {
        // Fila vazia: encerra drain; se o streaming terminou, revela a mensagem final
        clearInterval(drainIntervalRef.current!);
        drainIntervalRef.current = null;
        if (streamingCompleteRef.current) setDisplayText('');
        return;
      }
      const match = queue.match(/^(\S+[\s]*|[\s]+)/);
      if (!match) { clearInterval(drainIntervalRef.current!); drainIntervalRef.current = null; return; }
      const word = match[1];
      streamQueueRef.current = queue.slice(word.length);
      setDisplayText(prev => prev + word);
    }, 22);
  }, [stopDrain]);

  useLayoutEffect(() => {
    if (streamingText === null) {
      if (!streamingComplete) {
        // Pausa por tool call — limpa imediatamente
        stopDrain();
        streamQueueRef.current = '';
        prevStreamLenRef.current = 0;
        setDisplayText('');
      } else {
        // Streaming concluído — deixa a fila drenar naturalmente
        prevStreamLenRef.current = 0;
      }
      return;
    }
    const newChars = streamingText.slice(prevStreamLenRef.current);
    prevStreamLenRef.current = streamingText.length;
    if (!newChars) return;
    streamQueueRef.current += newChars;
    startDrain();
  }, [streamingText, streamingComplete, startDrain, stopDrain]);

  useEffect(() => () => stopDrain(), [stopDrain]);

  useAutoResizeTextArea(textAreaRef.current, inputValue);

  const handleSend = useCallback(() => {
    const textToSend = inputValue.trim();
    if (textToSend && !isLoading) {
      sendMessage(textToSend);
      setInputValue('');
      setChatStarted(true);
      if (isListening) stopListening();
    }
  }, [inputValue, isLoading, isListening, sendMessage, stopListening]);

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

  useLayoutEffect(() => {
    if (shouldStickToBottom.current && displayText) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [displayText]);

  const handleMicClick = () => {
    if (isListening) stopListening();
    else { setInputValue(''); startListening(); }
  };

  // Caixa de input — reutilizada nos dois estados (centrada e bottom)
  const InputBox = (
    <div className="relative w-full">
      {/* Caixa */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 focus-within:border-orange-400/70 transition-colors duration-200 overflow-hidden">
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
                isListening ? 'bg-orange-500/15 text-[#E07A2F]' : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              <SoundWaveIcon className="w-5 h-5" isListening={isListening} />
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
            className="flex-shrink-0 p-1.5 rounded-full bg-[#E07A2F] text-white disabled:bg-slate-700 disabled:cursor-not-allowed hover:bg-[#F08A3B] transition-colors"
          >
            <SendIcon className="w-5 h-5" />
          </button>
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
      `}</style>

      <div className="relative w-full h-full flex justify-center">

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
                  <div className="h-0.5 w-10 bg-[#E07A2F] rounded-full shadow-[0_0_10px_rgba(224,122,47,0.35)]" />
                </div>

                <div className="relative mb-5">
                  <div className="absolute inset-0 bg-orange-500/10 blur-3xl rounded-full" />
                  <ChatHeaderSphere size={120} />
                </div>
                <h2 className="text-lg font-semibold text-white mb-2 tracking-tight">Como posso ajudar hoje?</h2>
                <p className="text-sm text-slate-400 max-w-[280px] leading-relaxed">
                  Explore dados de empresas, MEIs, setores e municípios com a Nadia.
                </p>
              </div>

              {/* Action Chips: Preenchendo o vácuo com utilidade */}
              <div className="w-full max-w-lg mb-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 text-center">Sugestões de Consulta</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "Quantas empresas foram abertas em Campinas em 2026?",
                    "Qual o ranking de municípios em empresas Inova Simples?",
                    "Mostre a evolução de MEIs em Franca"
                  ].map((sugestao) => (
                    <button
                      key={sugestao}
                      onClick={() => {
                        setInputValue(sugestao);
                        // Pequeno delay para efeito visual antes de enviar
                        setTimeout(() => handleSend(), 150);
                      }}
                      className="px-4 py-2 rounded-full bg-slate-800/40 border border-white/5 text-slate-300 text-xs font-medium hover:bg-orange-500/10 hover:border-orange-400/30 transition-all active:scale-95"
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
                  <div className="h-0.5 w-5 bg-[#E07A2F] rounded-full shadow-[0_0_6px_rgba(224,122,47,0.35)]" />
                </div>
              </div>
              <main ref={scrollContainerRef} className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-6">
                {messages.map((msg, index) => {
                  // Esconde a última mensagem do modelo enquanto a animação de drain está ativa
                  if (displayText && streamingComplete && index === messages.length - 1 && msg.role === 'model') return null;
                  return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'model' && <div className="flex-shrink-0"><ChatHeaderSphere /></div>}
                    <div className={`max-w-xl rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-[#E07A2F] text-white rounded-br-none shadow-[0_4px_12px_rgba(224,122,47,0.18)]'
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
                  );
                })}
                {displayText && (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0"><ChatHeaderSphere /></div>
                    <div className="max-w-xl rounded-2xl px-4 py-3 bg-slate-700 text-slate-200 rounded-bl-none">
                      <span className="whitespace-pre-wrap leading-relaxed">{displayText}</span>
                      <span className="inline-block w-[2px] h-[1em] bg-orange-300/70 ml-0.5 align-middle animate-pulse" />
                    </div>

                  </div>
                )}
                {isLoading && !displayText && (
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

              <footer className="flex-shrink-0 px-4 pt-2 pb-safe border-t border-slate-700/50">

                {InputBox}
              </footer>
            </>
          )}
        </div>

      </div>
    </>
  );
};

export default ChatView;
