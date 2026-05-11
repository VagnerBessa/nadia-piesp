import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateWithFallback } from '../services/geminiService';
import { GraphData } from '../services/piespGraphService';
import { GraphMetrics } from '../utils/graphAnalytics';
import CapivaraPet from './CapivaraPet';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface GraphCopilotProps {
  graphData: GraphData;
  metrics: GraphMetrics | null;
}

function formatValorCtx(v: number) {
  return v >= 1000 ? `R$ ${(v / 1000).toFixed(1)} bi` : `R$ ${v.toFixed(0)} mi`;
}

function buildGraphContext(graphData: GraphData, metrics: GraphMetrics | null): string {
  const { meta, nodes, edges } = graphData;
  const lines: string[] = [];

  lines.push(`=== GRAFO PIESP CARREGADO ===`);
  if (meta.no_central) lines.push(`Consulta centrada em: ${meta.no_central}`);
  lines.push(`Nós: ${nodes.length} | Arestas: ${edges.length}`);
  lines.push(`Projetos: ${meta.total_projetos} (${meta.total_com_valor} com valor, ${meta.total_sem_valor} sem valor)`);
  if (meta.total_valor_milhoes > 0)
    lines.push(`Valor total visível: ${formatValorCtx(meta.total_valor_milhoes)}`);

  if (!metrics) return lines.join('\n');

  // Distribuição de tipos de nó
  const byType: Record<string, number> = {};
  nodes.forEach(n => { byType[n.type] = (byType[n.type] ?? 0) + 1; });
  lines.push(`\nCOMPOSIÇÃO: ${Object.entries(byType).map(([t, c]) => `${c} ${t}`).join(', ')}`);

  // Indicadores estruturais
  lines.push(`\nESTRUTURA:`);
  lines.push(`  Densidade: ${(metrics.density * 100).toFixed(1)}%`);
  lines.push(`  Componentes conectados: ${metrics.components}`);
  lines.push(`  Nós pontes (alta intermediação): ${metrics.bridges.length}`);
  lines.push(`  Nós periféricos de alto valor: ${metrics.peripheralHighValue.length}`);
  lines.push(`  Grau mediano: ${metrics.medianDegree.toFixed(1)} | Grau máximo: ${metrics.maxDegree}`);

  // Top 8 por grau
  const topDegree = nodes
    .map(n => ({ ...n, m: metrics.byNode[n.id] }))
    .filter(n => n.m)
    .sort((a, b) => (b.m!.degree - a.m!.degree) || (b.valor_total - a.valor_total))
    .slice(0, 8);

  lines.push(`\nTOP NÓS POR CONEXÕES:`);
  topDegree.forEach(n => {
    const m = n.m!;
    const comm = metrics.communityNames[m.community] ?? `C${m.community}`;
    const valor = n.valor_total > 0 ? ` | ${formatValorCtx(n.valor_total)}` : '';
    lines.push(`  ${n.label} (${n.type}) — ${m.degree} conexões | ${m.roleLabel} | ${comm}${valor}`);
  });

  // Nós ponte
  if (metrics.bridges.length > 0) {
    const bridgeNodes = metrics.bridges
      .slice(0, 5)
      .map(id => {
        const nd = nodes.find(n => n.id === id);
        const m  = metrics.byNode[id];
        return nd && m ? `${nd.label} (bet. ${(m.betweenness * 100).toFixed(1)}%)` : id;
      });
    lines.push(`\nNÓS PONTE (alta betweenness):`);
    bridgeNodes.forEach(b => lines.push(`  ${b}`));
  }

  // Comunidades
  const communityEntries = Object.entries(metrics.communityNames)
    .map(([cId, name]) => ({ cId: +cId, name, size: metrics.communitySize[+cId] ?? 0 }))
    .sort((a, b) => b.size - a.size);

  if (communityEntries.length > 0) {
    lines.push(`\nAGRUPAMENTOS (${communityEntries.length} comunidades detectadas):`);
    communityEntries.forEach(c => lines.push(`  #${c.cId} "${c.name}": ${c.size} nós`));
  }

  // Lacunas estruturais: comunidades com poucas arestas externas
  const commConn: Record<number, { int: number; ext: number }> = {};
  edges.forEach(e => {
    const sc = metrics.byNode[e.source]?.community;
    const tc = metrics.byNode[e.target]?.community;
    if (sc == null || tc == null) return;
    if (sc === tc) {
      commConn[sc] = commConn[sc] ?? { int: 0, ext: 0 };
      commConn[sc].int++;
    } else {
      commConn[sc] = commConn[sc] ?? { int: 0, ext: 0 };
      commConn[tc] = commConn[tc] ?? { int: 0, ext: 0 };
      commConn[sc].ext++;
      commConn[tc].ext++;
    }
  });
  const lacunas = Object.entries(commConn)
    .filter(([_, v]) => v.ext <= 2 && v.int >= 2)
    .map(([c]) => metrics.communityNames[+c] ?? `C${c}`)
    .slice(0, 4);
  if (lacunas.length > 0) {
    lines.push(`\nPOSSÍVEIS LACUNAS ESTRUTURAIS (comunidades com ≤2 ligações externas):`);
    lacunas.forEach(l => lines.push(`  "${l}"`));
  }

  return lines.join('\n');
}

const SUGESTOES = [
  'Quais nós são mais influentes nesta rede?',
  'Que agrupamentos temáticos existem e o que representam?',
  'Quais nós funcionam como pontes entre comunidades?',
  'Onde estão as lacunas estruturais?',
  'Como está concentrado o investimento entre os grupos?',
  'Que novas conexões fortaleceriam esta rede?',
  'Há nós periféricos com alto valor que deveriam ser mais centrais?',
];

const GraphCopilot: React.FC<GraphCopilotProps> = ({ graphData, metrics }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [petState, setPetState] = useState<'idle' | 'typing'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef('');

  // Rebuild context when graph/metrics change; reset conversation
  useEffect(() => {
    contextRef.current = buildGraphContext(graphData, metrics);
    setMessages([]);
  }, [graphData, metrics]);

  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setIsThinking(true);
    setPetState('typing');

    const history = messages
      .map(m => `${m.role === 'user' ? 'Usuário' : 'Nadia'}: ${m.content}`)
      .join('\n');

    const prompt = `${contextRef.current}

HISTÓRICO:
${history || '(primeira mensagem)'}

PERGUNTA: ${trimmed}

Você é a Nadia, analista de redes de investimentos da Fundação Seade. Com base nos dados do grafo acima, responda de forma concisa (3-5 frases), analítica e objetiva. Cite nomes de empresas, municípios ou agrupamentos quando relevante. Não invente dados que não estão no contexto. Responda em português.`;

    try {
      const res = await generateWithFallback({ prompt, thinkingBudget: 0 });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.text?.trim() || 'Não foi possível gerar uma resposta.',
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erro ao conectar com a Nadia. Tente novamente.',
      }]);
    } finally {
      setIsThinking(false);
      setPetState('idle');
    }
  }, [isThinking, messages]);

  return (
    <>
      {/* ── Toggle button */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={`absolute bottom-10 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-medium transition-all shadow-lg ${
          isOpen
            ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
            : 'bg-slate-900/90 border-slate-700/50 text-slate-400 hover:text-rose-300 hover:border-rose-500/30 backdrop-blur-sm'
        }`}
      >
        <span className="text-[10px]">✦</span>
        Copilot
        {messages.length > 0 && !isOpen && (
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
        )}
      </button>

      {/* ── Chat panel — slides up from bottom-right */}
      {isOpen && (
        <div
          className="absolute bottom-20 right-3 w-80 flex flex-col bg-slate-900/97 border border-slate-700/50 rounded-2xl shadow-2xl backdrop-blur-sm z-20 overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 14rem)' }}
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-slate-700/40 bg-slate-900/80">
            <div className="flex items-center gap-2">
              <CapivaraPet state={petState} size={28} withGlasses />
              <div>
                <p className="text-[11px] font-semibold text-slate-200 leading-tight">Nadia · Copilot</p>
                <p className="text-[9px] text-slate-500">
                  {graphData.nodes.length} nós · {graphData.edges.length} arestas
                  {metrics && metrics.communityCount > 0 && ` · ${metrics.communityCount} comunidades`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-600 hover:text-white transition-colors text-[11px] w-5 h-5 flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0" style={{ minHeight: '120px' }}>
            {messages.length === 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] text-slate-600 text-center pb-1">
                  Pergunte sobre a rede de investimentos carregada
                </p>
                {SUGESTOES.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-[10px] px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/30 text-slate-400 hover:text-white hover:border-slate-500/40 transition-all leading-snug"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-rose-500/15 text-rose-100 border border-rose-500/20'
                    : 'bg-slate-800/70 text-slate-200 border border-slate-700/30'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-slate-800/70 border border-slate-700/30 rounded-xl px-3 py-2.5 flex gap-1 items-center">
                  {[0, 150, 300].map(d => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-slate-700/40 p-2 flex gap-1.5">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(input); }}
              placeholder="Pergunte sobre a rede…"
              disabled={isThinking}
              className="flex-1 bg-slate-800/60 border border-slate-600/40 rounded-lg px-3 py-1.5 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500/40 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isThinking || !input.trim()}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-sm disabled:opacity-40 transition-colors flex items-center"
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default GraphCopilot;
