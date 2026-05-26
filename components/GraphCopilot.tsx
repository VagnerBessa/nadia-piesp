import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { generateWithFallback } from '../services/geminiService';
import { GraphData, GraphNode } from '../services/empreendedorismoGraphService';
import { GraphMetrics } from '../utils/graphAnalytics';
import CapivaraPet from './CapivaraPet';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface GraphCopilotProps {
  graphData: GraphData;
  metrics: GraphMetrics | null;
  selectedNode?: GraphNode | null;
  queryContext?: { modo: 'empresa' | 'tema' | 'regiao'; query: string };
}

// ── Formatadores ─────────────────────────────────────────────────────────────

function fv(v: number) {
  return v >= 1000 ? `R$ ${(v / 1000).toFixed(1)} bi` : `R$ ${v.toFixed(0)} mi`;
}

// ── Payload contextual ───────────────────────────────────────────────────────

function buildContext(
  graphData: GraphData,
  metrics: GraphMetrics | null,
  selectedNode: GraphNode | null | undefined,
  queryContext: { modo: string; query: string } | undefined,
): string {
  const { meta, nodes, edges } = graphData;
  const lines: string[] = [];

  // ─ Recorte
  lines.push('=== RECORTE ATIVO ===');
  if (queryContext) {
    const modoLabel = { empresa: 'Empresa', tema: 'Tema', regiao: 'Região' }[queryContext.modo] ?? queryContext.modo;
    lines.push(`Modo: ${modoLabel} | Consulta: "${queryContext.query}"`);
  }
  if (meta.no_central) lines.push(`Nó central: ${meta.no_central}`);
  lines.push(`Peso das arestas: número de anúncios em comum (não valor financeiro)`);

  // ─ Tamanho e cobertura
  lines.push(`\n=== TAMANHO DO GRAFO ===`);
  lines.push(`Nós visíveis: ${nodes.length}${meta.total_nos_disponiveis > nodes.length ? ` de ${meta.total_nos_disponiveis} disponíveis (top por valor)` : ''}`);
  lines.push(`Arestas visíveis: ${edges.length}`);
  lines.push(`Anúncios representados: ${meta.total_projetos} (${meta.total_com_valor} com valor declarado, ${meta.total_sem_valor} sem valor)`);
  if (meta.total_valor_milhoes > 0) lines.push(`Valor total visível: ${fv(meta.total_valor_milhoes)}`);

  // Composição por tipo de nó
  const byType: Record<string, number> = {};
  nodes.forEach(n => { byType[n.type] = (byType[n.type] ?? 0) + 1; });
  lines.push(`Composição: ${Object.entries(byType).map(([t, c]) => `${c} ${t}`).join(' | ')}`);

  if (!metrics) {
    lines.push('\n(métricas ainda sendo calculadas)');
    return lines.join('\n');
  }

  // ─ Estrutura
  lines.push(`\n=== ESTRUTURA DA REDE ===`);
  lines.push(`Densidade: ${(metrics.density * 100).toFixed(2)}%`);
  lines.push(`Componentes conectados: ${metrics.components}`);
  lines.push(`Grau mediano: ${metrics.medianDegree.toFixed(1)} | Grau máximo: ${metrics.maxDegree}`);
  lines.push(`Nós ponte (alta betweenness): ${metrics.bridges.length}`);
  lines.push(`Nós periféricos com alto valor de investimento: ${metrics.peripheralHighValue.length}`);

  // ─ Rankings por grau
  const topDegree = nodes
    .map(n => ({ ...n, m: metrics.byNode[n.id] }))
    .filter(n => n.m)
    .sort((a, b) => b.m!.degree - a.m!.degree)
    .slice(0, 8);

  lines.push(`\n=== TOP NÓS POR CONEXÕES (grau) ===`);
  topDegree.forEach(n => {
    const m = n.m!;
    const comm = metrics.communityNames[m.community] ?? `C${m.community}`;
    const valor = n.valor_total > 0 ? ` | ${fv(n.valor_total)}` : '';
    lines.push(`  ${n.label} (${n.type}) — ${m.degree} conexões | ${(m.betweenness * 100).toFixed(1)}% betw. | ${m.roleLabel} | ${comm}${valor}`);
  });

  // ─ Rankings por valor
  const topValor = [...nodes]
    .filter(n => n.valor_total > 0)
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, 6);
  if (topValor.length > 0) {
    lines.push(`\n=== TOP NÓS POR VALOR DE INVESTIMENTO ===`);
    topValor.forEach(n => {
      lines.push(`  ${n.label} (${n.type}) — ${fv(n.valor_total)} em ${n.count} anúncio${n.count !== 1 ? 's' : ''}`);
    });
  }

  // ─ Rankings por número de anúncios
  const topAnuncios = [...nodes]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  lines.push(`\n=== TOP NÓS POR NÚMERO DE ANÚNCIOS ===`);
  topAnuncios.forEach(n => {
    lines.push(`  ${n.label} (${n.type}) — ${n.count} anúncio${n.count !== 1 ? 's' : ''}${n.count_sem_valor > 0 ? ` (${n.count_sem_valor} sem valor)` : ''}`);
  });

  // ─ Nós ponte
  if (metrics.bridges.length > 0) {
    lines.push(`\n=== NÓS PONTE ===`);
    metrics.bridges.slice(0, 6).forEach(id => {
      const nd = nodes.find(n => n.id === id);
      const m  = metrics.byNode[id];
      if (nd && m) lines.push(`  ${nd.label} (${nd.type}) — betweenness ${(m.betweenness * 100).toFixed(1)}% | grau ${m.degree}`);
    });
  }

  // ─ Periféricos de alto valor
  if (metrics.peripheralHighValue.length > 0) {
    lines.push(`\n=== NÓS PERIFÉRICOS COM ALTO VALOR ===`);
    metrics.peripheralHighValue.slice(0, 4).forEach(id => {
      const nd = nodes.find(n => n.id === id);
      const m  = metrics.byNode[id];
      if (nd) lines.push(`  ${nd.label} (${nd.type}) — grau ${m?.degree ?? '?'} | ${nd.valor_total > 0 ? fv(nd.valor_total) : 'valor não declarado'}`);
    });
  }

  // ─ Comunidades
  const communityEntries = Object.entries(metrics.communityNames)
    .map(([cId, name]) => ({ cId: +cId, name, size: metrics.communitySize[+cId] ?? 0 }))
    .sort((a, b) => b.size - a.size);

  if (communityEntries.length > 0) {
    lines.push(`\n=== COMUNIDADES DETECTADAS (${communityEntries.length}) ===`);
    communityEntries.forEach(c => {
      // Listar 3 nós mais conectados da comunidade como caracterização
      const membros = nodes
        .filter(n => metrics.byNode[n.id]?.community === c.cId)
        .sort((a, b) => (metrics.byNode[b.id]?.degree ?? 0) - (metrics.byNode[a.id]?.degree ?? 0))
        .slice(0, 3)
        .map(n => `${n.label}(${n.type})`);
      lines.push(`  #${c.cId} "${c.name}": ${c.size} nós | principais: ${membros.join(', ')}`);
    });
  }

  // ─ Lacunas estruturais
  const commConn: Record<number, { int: number; ext: number }> = {};
  edges.forEach(e => {
    const sc = metrics.byNode[e.source]?.community;
    const tc = metrics.byNode[e.target]?.community;
    if (sc == null || tc == null) return;
    if (sc === tc) { commConn[sc] = commConn[sc] ?? { int: 0, ext: 0 }; commConn[sc].int++; }
    else {
      commConn[sc] = commConn[sc] ?? { int: 0, ext: 0 }; commConn[sc].ext++;
      commConn[tc] = commConn[tc] ?? { int: 0, ext: 0 }; commConn[tc].ext++;
    }
  });
  const lacunas = Object.entries(commConn)
    .filter(([_, v]) => v.ext <= 2 && v.int >= 2)
    .map(([c]) => metrics.communityNames[+c] ?? `C${c}`)
    .slice(0, 4);
  if (lacunas.length > 0) {
    lines.push(`\n=== LACUNAS ESTRUTURAIS (comunidades com ≤2 ligações externas) ===`);
    lacunas.forEach(l => lines.push(`  "${l}"`));
  }

  // ─ Nó selecionado
  if (selectedNode) {
    const sm = metrics.byNode[selectedNode.id];
    const vizinhos = edges
      .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
      .map(e => e.source === selectedNode.id ? e.target : e.source)
      .map(id => nodes.find(n => n.id === id))
      .filter((n): n is GraphNode => !!n)
      .sort((a, b) => b.valor_total - a.valor_total)
      .slice(0, 6);

    lines.push(`\n=== NÓ SELECIONADO PELO USUÁRIO ===`);
    lines.push(`  Nome: ${selectedNode.label}`);
    lines.push(`  Tipo: ${selectedNode.type}`);
    lines.push(`  Anúncios: ${selectedNode.count} (${selectedNode.count_sem_valor} sem valor)`);
    if (selectedNode.valor_total > 0) lines.push(`  Valor total: ${fv(selectedNode.valor_total)}`);
    if (selectedNode.ano_min) lines.push(`  Período: ${selectedNode.ano_min}–${selectedNode.ano_max ?? '...'}`);
    if (sm) {
      lines.push(`  Grau: ${sm.degree} | Betweenness: ${(sm.betweenness * 100).toFixed(1)}%`);
      lines.push(`  Papel estrutural: ${sm.roleLabel} — ${sm.roleDesc}`);
      lines.push(`  Comunidade: ${metrics.communityNames[sm.community] ?? `#${sm.community}`}`);
    }
    if (vizinhos.length > 0) {
      lines.push(`  Principais vizinhos: ${vizinhos.map(v => `${v.label}(${v.type})`).join(', ')}`);
    }
  }

  // ─ Alertas metodológicos
  const alertas: string[] = [
    'Os dados representam ANÚNCIOS de investimento, não investimentos realizados.',
    `Peso das arestas = número de anúncios em comum, NÃO valor financeiro.`,
  ];
  if (meta.total_sem_valor > 0)
    alertas.push(`${meta.total_sem_valor} anúncios sem valor declarado não entram nos rankings de investimento.`);
  if (meta.total_nos_disponiveis > nodes.length)
    alertas.push(`Visualização parcial: ${nodes.length} de ${meta.total_nos_disponiveis} nós disponíveis.`);
  if (metrics.components > 1)
    alertas.push(`O grafo tem ${metrics.components} componentes desconectados — alguns grupos não têm ligação com o cluster principal.`);
  if (nodes.length < 15)
    alertas.push(`Recorte pequeno (${nodes.length} nós) — padrões devem ser tratados como exploratórios.`);

  lines.push(`\n=== ALERTAS METODOLÓGICOS ===`);
  alertas.forEach(a => lines.push(`  ⚠ ${a}`));

  return lines.join('\n');
}

// ── System prompt com salvaguardas ───────────────────────────────────────────

const SYSTEM_PROMPT = `Você é a Nadia, analista de redes de investimentos da Fundação Seade. Sua função é interpretar o grafo atual com profundidade econômica, não apenas descrevê-lo.

ANCORAGEM — toda análise parte dos dados do grafo:
Os dados do contexto (nós, arestas, métricas, comunidades, rankings) são sua matéria-prima obrigatória. Cite números e estruturas concretas para sustentar qualquer interpretação.

LIBERDADE ANALÍTICA — a partir dos dados, você pode e deve:
- Fazer interpretações econômicas: o que a estrutura da rede sugere sobre dinâmicas setoriais, concentração, dependência, diversificação
- Formular hipóteses sobre padrões observados ("a alta centralidade de X pode indicar...")
- Relacionar a estrutura do grafo com fenômenos econômicos mais amplos (cadeias produtivas, substituição de importações, transições energéticas, etc.) quando a conexão for plausível e explicitada como hipótese
- Identificar oportunidades, riscos ou anomalias que os padrões estruturais sugerem
- Comparar agrupamentos e inferir lógicas de negócio subjacentes

O QUE EVITAR:
- Invenção de dados não presentes no contexto
- Afirmações causais sem qualificação ("X causa Y" → prefira "X pode estar relacionado a Y")
- Generalizações sobre a economia paulista que não tenham ancoragem nos dados do grafo

SALVAGUARDAS — sinalize quando necessário, sem repetir a cada resposta:
- Centralidade estrutural ≠ importância econômica absoluta
- Arestas = co-ocorrência em anúncios, não vínculo contratual ou societário
- Os dados representam anúncios de investimento, não investimentos realizados
- Recorte pequeno (<20 nós): padrões são exploratórios

FORMATO:
- Dados citados de forma compacta: números e estruturas em uma frase, sem expandir o óbvio
- Interpretação econômica desenvolvida logo em seguida, sem repetir os dados já citados
- Hipóteses marcadas como tal ("sugere", "pode indicar", "é plausível que")
- Extensão: 2–3 frases para consultas simples, até 6 para análises estruturais ou comparações
- Idioma: português brasileiro
- Prosa corrida — sem asteriscos, bullet points ou numeração`;

// ── Sugestões contextuais ────────────────────────────────────────────────────

const SUGESTOES_PADRAO = [
  'Resuma o recorte atual.',
  'Quais nós são mais influentes?',
  'Que comunidades existem e o que representam?',
  'Quais nós funcionam como pontes?',
  'Há concentração territorial?',
  'Onde estão as lacunas estruturais?',
  'Quais cuidados metodológicos devo ter?',
];

function getSugestoesComNo(node: GraphNode): string[] {
  const tipo = { empresa: 'esta empresa', municipio: 'este município', setor: 'este setor', investidora: 'esta empresa' }[node.type] ?? 'este nó';
  return [
    `Explique o papel de ${node.label} nesta rede.`,
    `${node.label} é central ou periférico?`,
    `A quais comunidades ${node.label} está ligado?`,
    `Quais são as conexões mais importantes de ${node.label}?`,
    `Compare ${node.label} com os nós vizinhos.`,
    `${node.label} tem perfil concentrado ou diversificado?`,
    `Há nós periféricos com alto valor que merecem atenção?`,
  ];
}

// ── Componente ───────────────────────────────────────────────────────────────

const GraphCopilot: React.FC<GraphCopilotProps> = ({
  graphData, metrics, selectedNode, queryContext,
}) => {
  const [isOpen,     setIsOpen]     = useState(false);
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [petState,   setPetState]   = useState<'idle' | 'typing'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const contextRef     = useRef('');

  // Reconstrói contexto quando grafo, métricas ou nó selecionado mudam
  useEffect(() => {
    contextRef.current = buildContext(graphData, metrics, selectedNode, queryContext);
  }, [graphData, metrics, selectedNode, queryContext]);

  // Reset da conversa apenas quando o grafo muda (não ao selecionar nó)
  useEffect(() => {
    setMessages([]);
  }, [graphData]);

  useEffect(() => {
    if (messagesEndRef.current && isOpen)
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen]);

  const sugestoes = useMemo(
    () => selectedNode ? getSugestoesComNo(selectedNode) : SUGESTOES_PADRAO,
    [selectedNode],
  );

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

    const prompt = `${SYSTEM_PROMPT}

${contextRef.current}

HISTÓRICO DA CONVERSA:
${history || '(primeira mensagem)'}

PERGUNTA DO USUÁRIO: ${trimmed}`;

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
      {/* ── Botão toggle */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={`absolute bottom-10 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-medium transition-all shadow-lg ${
          isOpen
            ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
            : 'bg-slate-900/90 border-slate-700/50 text-slate-400 hover:text-rose-300 hover:border-rose-500/30 backdrop-blur-sm'
        }`}
      >
        <CapivaraPet state="idle" size={20} withGlasses />
        Nadia
        {selectedNode && !isOpen && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title={`Nó selecionado: ${selectedNode.label}`} />
        )}
        {messages.length > 0 && !isOpen && !selectedNode && (
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
        )}
      </button>

      {/* ── Painel de chat */}
      {isOpen && (
        <div
          className="absolute bottom-20 right-3 w-80 flex flex-col bg-slate-900/97 border border-slate-700/50 rounded-2xl shadow-2xl backdrop-blur-sm z-20 overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 14rem)' }}
        >
          {/* Cabeçalho */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-slate-700/40 bg-slate-900/80">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-[11px] font-semibold text-slate-200 leading-tight">Nadia · Análise de Rede</p>
                <p className="text-[9px] text-slate-500 truncate max-w-[180px]">
                  {selectedNode
                    ? `Nó: ${selectedNode.label}`
                    : `${graphData.nodes.length} nós · ${graphData.edges.length} arestas${metrics && metrics.communityCount > 0 ? ` · ${metrics.communityCount} comunidades` : ''}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  title="Limpar conversa"
                  className="text-slate-600 hover:text-slate-300 transition-colors text-[10px] w-5 h-5 flex items-center justify-center flex-shrink-0"
                >
                  ⌫
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-600 hover:text-white transition-colors text-[11px] w-5 h-5 flex items-center justify-center flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0" style={{ minHeight: '120px' }}>
            {messages.length === 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] text-slate-600 text-center pb-1">
                  {selectedNode
                    ? `Nó selecionado: ${selectedNode.label}`
                    : 'Pergunte sobre o recorte atual do grafo'}
                </p>
                {sugestoes.map(s => (
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

            {/* Indicador de mudança de nó selecionado */}
            {messages.length > 0 && selectedNode && (
              <div className="text-center">
                <span className="text-[9px] text-emerald-600 bg-emerald-900/20 px-2 py-0.5 rounded-full">
                  Nó selecionado: {selectedNode.label}
                </span>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
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
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                      style={{ animationDelay: `${d}ms` }} />
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
              placeholder="Pergunte sobre o recorte…"
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
