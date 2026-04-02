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

const ChatView: React.FC<ChatViewProps> = ({ onNavigateHome }) => {
  const { messages, sendMessage, isLoading } = useChat();
  const { text: speechText, startListening, stopListening, isListening, hasRecognitionSupport } = useSpeechRecognition();
  const [inputValue, setInputValue] = useState('');
  const [responseMode, setResponseMode] = useState<ResponseMode>('complete');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const prevIsListening = useRef(isListening);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottom = useRef(true);

  useAutoResizeTextArea(textAreaRef.current, inputValue);

  const handleSend = useCallback(() => {
    const textToSend = inputValue.trim();
    if (textToSend && !isLoading) {
      sendMessage(textToSend, responseMode);
      setInputValue('');
      if (isListening) {
        stopListening();
      }
    }
  }, [inputValue, isLoading, isListening, sendMessage, stopListening, responseMode]);

  useEffect(() => {
    // When speech recognition provides new text, update the input field.
    if (speechText) {
      setInputValue(speechText);
    }
  }, [speechText]);
  
  useEffect(() => {
    // Auto-send logic: if listening has just stopped (transitioned from true to false)
    // and there's text in the input (from speech), send the message.
    if (prevIsListening.current && !isListening && inputValue.trim()) {
      handleSend();
    }
    // Update the ref to the current listening state for the next render.
    prevIsListening.current = isListening;
  }, [isListening, inputValue, handleSend]);

  // Effect to attach scroll listener and determine if user scrolled up
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Check if user is at the bottom with a small tolerance
      const isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 10;
      shouldStickToBottom.current = isAtBottom;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Effect to scroll to bottom only if user hasn't scrolled up
  useLayoutEffect(() => {
    if (shouldStickToBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      setInputValue('');
      startListening();
    }
  };

  return (
    <>
      <style>
        {`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #475569; /* slate-600 */
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #64748b; /* slate-500 */
          }
          /* For Firefox */
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #475569 transparent;
          }
        `}
      </style>
      <div className="w-full h-full flex flex-col max-w-3xl mx-auto bg-transparent">
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-4">
            <ChatHeaderSphere />
            <h1 className="text-xl font-bold text-slate-100">Nadia</h1>
          </div>
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-800/70 hover:bg-slate-700/90 border border-slate-700 text-slate-300 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-500 backdrop-blur-sm shadow-lg"
            aria-label="Voltar"
            title="Voltar"
          >
            <SwitchModeIcon className="h-5 w-5" />
            <span className="hidden sm:inline text-sm font-medium leading-none">Voltar</span>
          </button>
        </header>

        <main ref={scrollContainerRef} className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-6">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && <div className="flex-shrink-0"><ChatHeaderSphere /></div>}
              <div className={`max-w-xl rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-rose-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
                <MarkdownRenderer content={msg.text} />
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <h4 className="text-xs font-semibold text-slate-400 mb-1.5">Fontes:</h4>
                    <ul className="text-xs space-y-1">
                      {msg.sources.map((source, i) => (
                        <li key={i}>
                          <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 hover:underline truncate block">
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

        <footer className="flex-shrink-0 p-4 border-t border-slate-700/50">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 focus-within:border-rose-500 transition-colors overflow-hidden">
            {/* Input Area */}
            <div className="flex items-end gap-2 p-2">
              <textarea
                ref={textAreaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isListening ? 'Ouvindo...' : 'Digite sua mensagem...'}
                rows={1}
                className="flex-grow bg-transparent text-slate-200 placeholder-slate-400 focus:outline-none resize-none custom-scrollbar p-2"
                disabled={isLoading}
              />
              {hasRecognitionSupport && (
                <button onClick={handleMicClick} disabled={isLoading} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-rose-500/20 text-rose-500' : 'text-slate-400 hover:bg-slate-700'}`}>
                  <SoundWaveIcon className="w-6 h-6" isListening={isListening} />
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                className="p-2 rounded-full bg-rose-600 text-white disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-rose-500 transition-colors"
                aria-label="Enviar mensagem"
              >
                <SendIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Response Mode Selector Area */}
            <div className="border-t border-slate-700/50 px-3 py-2 bg-slate-800/20">
              <div className="flex items-center justify-center gap-3">
                <span className="text-xs text-slate-400 font-medium">Modo de Resposta:</span>
                <div className="flex items-center bg-slate-700/60 rounded-full p-0.5 text-xs">
                  <button
                      onClick={() => setResponseMode('fast')}
                      className={`px-2.5 py-0.5 rounded-full transition-colors ${responseMode === 'fast' ? 'bg-slate-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
                  >
                      Rápido
                  </button>
                  <button
                      onClick={() => setResponseMode('complete')}
                      className={`px-2.5 py-0.5 rounded-full transition-colors ${responseMode === 'complete' ? 'bg-slate-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
                  >
                      Completo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default ChatView;