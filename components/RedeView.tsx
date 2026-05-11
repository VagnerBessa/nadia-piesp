import React, { useState, useEffect, useCallback, Component } from 'react';
import CapivaraPet from './CapivaraPet';
import GraphCanvas from './GraphCanvas';
import {
  getRedeEmpresa, getRedeRegiao, getRedeTema, getRedeQuery,
  GraphData, GraphNode,
} from '../services/piespGraphService';
import { getMetadados } from '../services/piespDataService';
import { GraphMetrics } from '../utils/graphAnalytics';

class GraphErrorBoundary extends Component<
  { children: React.ReactNode; onReset: () => void },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  componentDidCatch(e: Error, info: any) { console.error('[GraphCanvas crash]', e, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#040d18] z-10">
          <p className="text-rose-400 text-sm text-center max-w-md px-6">
            Erro ao renderizar o grafo: <span className="font-mono text-xs">{this.state.error}</span>
          </p>
          <button
            onClick={() => { this.setState({ error: null }); this.props.onReset(); }}
            className="px-4 py-1.5 rounded-lg text-xs bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors">
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface RedeViewProps { onNavigateHome: () => void; }
type Modo = 'empresa' | 'tema' | 'regiao';

const NODE_COLORS: Record<string, string> = {
  investidora:  '#f43f5e',
  empresa_alvo: '#38bdf8',
  municipio:    '#34d399',
  setor:        '#a78bfa',
};
const NODE_LABELS: Record<string, string> = {
  investidora:  'Investidora',
  empresa_alvo: 'Empresa alvo',
  municipio:    'Município',
  setor:        'Setor',
};
const ROLE_COLORS: Record<string, string> = {
  concentrador: '#f43f5e',
  ponte:        '#f59e0b',
  intermediário: '#38bdf8',
  periférico:   '#64748b',
};

const TEMAS_RAPIDOS = [
  { label: 'Transição Energética',  keywords: ['energia', 'solar', 'eolica', 'renovavel', 'hidrogenio', 'biocombustivel', 'sustentabilidade', 'eolico'] },
  { label: 'Inovação e Tecnologia', keywords: ['tecnologia', 'inovacao', 'data center', 'inteligencia artificial', 'startup', 'pesquisa', 'p&d'] },
  { label: 'Logística',             keywords: ['logistica', 'armazem', 'porto', 'ferrovia', 'rodovia', 'distribuicao', 'modal'] },
  { label: 'Cadeias Produtivas',    keywords: ['cadeia produtiva', 'fornecedor', 'manufatura', 'polo industrial', 'insumo', 'componente'] },
  { label: 'Comércio Exterior',     keywords: ['exportacao', 'importacao', 'terminal', 'comercio exterior', 'aduaneiro', 'export'] },
];

function formatValor(v: number) {
  return v >= 1000
    ? `R$ ${(v / 1000).toFixed(1).replace('.', ',')} bi`
    : `R$ ${v.toFixed(0)} mi`;
}

function degRelDesc(degree: number, median: number): string {
  if (degree === 0) return 'sem conexões no recorte';
  const ratio = median > 0 ? degree / median : 1;
  if (ratio >= 2)  return `muito acima da mediana do recorte (${median.toFixed(0)})`;
  if (ratio >= 1)  return `acima da mediana do recorte (${median.toFixed(0)})`;
  if (ratio >= 0.5) return `próximo da mediana do recorte (${median.toFixed(0)})`;
  return `abaixo da mediana do recorte (${median.toFixed(0)})`;
}

// ── Node comparison ────────────────────────────────────────────────────────

function ComparePanel({
  nodeA, nodeB, graphData, metrics, onClose,
}: {
  nodeA: GraphNode;
  nodeB: GraphNode;
  graphData: GraphData;
  metrics: GraphMetrics;
  onClose: () => void;
}) {
  const mA = metrics.byNode[nodeA.id];
  const mB = metrics.byNode[nodeB.id];

  function commonConnections(): number {
    const nA = new Set(graphData.edges
      .filter(e => e.source === nodeA.id || e.target === nodeA.id)
      .map(e => e.source === nodeA.id ? e.target : e.source));
    return graphData.edges
      .filter(e => e.source === nodeB.id || e.target === nodeB.id)
      .filter(e => nA.has(e.source === nodeB.id ? e.target : e.source)).length;
  }

  function buildSynthesis(): string {
    if (!mA || !mB) return '';
    const parts: string[] = [];
    if (mA.degree !== mB.degree) {
      const [more, less] = mA.degree > mB.degree ? [nodeA, nodeB] : [nodeB, nodeA];
      const [mMore, mLess] = mA.degree > mB.degree ? [mA, mB] : [mB, mA];
      parts.push(`${more.label} está mais conectado (${mMore.degree} conexões vs. ${mLess.degree} de ${less.label}).`);
    } else {
      parts.push(`Ambos têm ${mA.degree} conexões no recorte.`);
    }
    if (mA.community !== mB.community) {
      parts.push('Pertencem a agrupamentos estruturais distintos.');
    } else {
      parts.push('Pertencem ao mesmo agrupamento estrutural.');
    }
    if (mA.role !== mB.role) {
      parts.push(`${nodeA.label} tem papel de ${mA.roleLabel.toLowerCase()} enquanto ${nodeB.label} é ${mB.roleLabel.toLowerCase()}.`);
    }
    const common = commonConnections();
    if (common > 0) parts.push(`Compartilham ${common} conexão${common > 1 ? 'ões' : ''} em comum.`);
    return parts.join(' ');
  }

  const rows = [
    { label: 'Conexões', a: mA?.degree ?? '—', b: mB?.degree ?? '—' },
    { label: 'Papel', a: mA?.roleLabel ?? '—', b: mB?.roleLabel ?? '—' },
    { label: 'Agrupamento',
      a: mA != null ? (metrics.communityNames[mA.community] ?? `#${mA.community}`) : '—',
      b: mB != null ? (metrics.communityNames[mB.community] ?? `#${mB.community}`) : '—' },
    { label: 'Projetos', a: nodeA.count, b: nodeB.count },
    { label: 'Valor', a: nodeA.valor_total > 0 ? formatValor(nodeA.valor_total) : '—', b: nodeB.valor_total > 0 ? formatValor(nodeB.valor_total) : '—' },
    { label: 'Centralidade', a: mA ? (mA.betweenness * 100).toFixed(1) + '%' : '—', b: mB ? (mB.betweenness * 100).toFixed(1) + '%' : '—' },
  ];

  return (
    <div className="border-t border-slate-700/40 pt-3 mt-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] uppercase tracking-wider text-slate-500">Comparação</p>
        <button onClick={onClose} className="text-[10px] text-slate-600 hover:text-white">✕</button>
      </div>
      <div className="bg-slate-800/40 rounded-lg overflow-hidden text-[10px] mb-2">
        <div className="grid grid-cols-3 bg-slate-800/80 px-2 py-1.5 text-slate-500">
          <span></span>
          <span className="text-center truncate text-rose-400">{nodeA.label}</span>
          <span className="text-center truncate text-sky-400">{nodeB.label}</span>
        </div>
        {rows.map(row => (
          <div key={row.label} className="grid grid-cols-3 px-2 py-1 border-t border-slate-700/20">
            <span className="text-slate-600">{row.label}</span>
            <span className="text-center text-slate-300">{String(row.a)}</span>
            <span className="text-center text-slate-300">{String(row.b)}</span>
          </div>
        ))}
      </div>
      {buildSynthesis() && (
        <p className="text-[10px] text-slate-400 leading-relaxed">{buildSynthesis()}</p>
      )}
    </div>
  );
}

// ── Node detail panel ─────────────────────────────────────────────────────

function NodePanel({
  node, graphData, metrics, isLoading,
  onExpand, onClose, onCompareWith,
}: {
  node: GraphNode;
  graphData: GraphData;
  metrics: GraphMetrics | null;
  isLoading: boolean;
  onExpand: (n: GraphNode) => void;
  onClose: () => void;
  onCompareWith: (id: string) => void;
}) {
  const [compareId, setCompareId] = useState<string | null>(null);
  const nm = metrics?.byNode[node.id];

  const vizinhos = graphData.edges
    .filter(e => e.source === node.id || e.target === node.id)
    .map(e => e.source === node.id ? e.target : e.source)
    .map(id => graphData.nodes.find(n => n.id === id))
    .filter((n): n is GraphNode => !!n)
    .sort((a, b) => b.valor_total - a.valor_total || b.count - a.count);

  const compareNode = compareId ? graphData.nodes.find(n => n.id === compareId) ?? null : null;

  return (
    <div className="absolute top-3 right-3 w-72 max-h-[calc(100%-24px)] flex flex-col bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-xl backdrop-blur-sm text-sm overflow-hidden z-30">

      {/* ── Basic info */}
      <div className="flex-shrink-0 p-4 space-y-3 border-b border-slate-700/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded"
              style={{ background: NODE_COLORS[node.type] + '22', color: NODE_COLORS[node.type] }}>
              {NODE_LABELS[node.type]}
            </span>
            <p className="text-white font-medium mt-1 leading-tight break-words">{node.label}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white flex-shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-slate-800/60 rounded-lg p-2">
            <p className="text-[10px] text-slate-400">Projetos</p>
            <p className="text-lg font-bold text-white">{node.count}</p>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-2">
            <p className="text-[10px] text-slate-400">Valor total</p>
            <p className="text-sm font-bold text-rose-400">
              {node.valor_total > 0 ? formatValor(node.valor_total) : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500">
          {node.ano_min && (
            <span>
              {node.ano_min === node.ano_max ? `${node.ano_min}` : `${node.ano_min} – ${node.ano_max}`}
            </span>
          )}
          {node.count_sem_valor > 0 && <span>{node.count_sem_valor} sem valor</span>}
        </div>

        <button onClick={() => onExpand(node)} disabled={isLoading}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-slate-700/60 hover:bg-slate-600/70 border border-slate-600/40 hover:border-slate-500/50 text-slate-300 hover:text-white transition-all disabled:opacity-40">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Explorar rede completa
        </button>
      </div>

      {/* ── Analytics section */}
      {nm && metrics && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/40 space-y-2">
          <p className="text-[9px] uppercase tracking-wider text-slate-600">Análise no recorte</p>

          {/* Role badge + community */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: ROLE_COLORS[nm.role] + '22', color: ROLE_COLORS[nm.role] }}>
              {nm.roleLabel}
            </span>
            {metrics.communityNames[nm.community] && (
              <span className="text-[9px] text-slate-500 truncate max-w-[140px]"
                title={`Agrupamento: ${metrics.communityNames[nm.community]}`}>
                ⬡ {metrics.communityNames[nm.community]}
              </span>
            )}
          </div>

          {/* Degree in context */}
          <p className="text-[10px] text-slate-400 leading-snug">
            <span className="text-slate-200 font-medium">{nm.degree} conexões</span>
            {' '}no recorte — {degRelDesc(nm.degree, metrics.medianDegree)}.
          </p>

          {/* Betweenness interpretation */}
          {nm.betweenness > 0.01 && (
            <p className="text-[10px] text-slate-500 leading-snug">
              {nm.betweenness > 0.3
                ? 'Funciona como ponte relevante entre diferentes agrupamentos da rede.'
                : nm.betweenness > 0.1
                ? 'Tem algum papel de intermediação entre agrupamentos.'
                : 'Baixa intermediação — inserido principalmente em seu próprio agrupamento.'}
            </p>
          )}

          {/* Role description */}
          <p className="text-[10px] text-slate-600 leading-snug italic">{nm.roleDesc}</p>
        </div>
      )}

      {/* ── Neighbors + compare */}
      {vizinhos.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
            {vizinhos.length} conexão{vizinhos.length !== 1 ? 'ões' : ''}
          </p>
          {vizinhos.map(v => (
            <div key={v.id} className="flex items-center gap-1">
              <button onClick={() => onCompareWith(v.id)}
                className="flex-1 flex items-center gap-2 text-left bg-slate-800/40 hover:bg-slate-800/80 rounded px-2 py-1.5 transition-colors group">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: NODE_COLORS[v.type] ?? '#94a3b8' }} />
                <span className="flex-1 text-[11px] text-slate-300 group-hover:text-white truncate">{v.label}</span>
                {v.valor_total > 0 && <span className="text-[10px] text-slate-500 flex-shrink-0">{formatValor(v.valor_total)}</span>}
              </button>
              <button onClick={() => setCompareId(compareId === v.id ? null : v.id)}
                title="Comparar"
                className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-[9px] transition-all ${
                  compareId === v.id
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    : 'text-slate-600 hover:text-slate-300 hover:bg-slate-700/40'}`}>
                ⇔
              </button>
            </div>
          ))}

          {/* Comparison panel */}
          {compareId && compareNode && metrics && (
            <ComparePanel
              nodeA={node}
              nodeB={compareNode}
              graphData={graphData}
              metrics={metrics}
              onClose={() => setCompareId(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── RedeView ─────────────────────────────────────────────────────────────

const RedeView: React.FC<RedeViewProps> = ({ onNavigateHome: _nav }) => {
  const [modo, setModo]               = useState<Modo>('empresa');
  const [query, setQuery]             = useState('');
  const [graphData, setGraphData]     = useState<GraphData | null>(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [regioes, setRegioes]         = useState<string[]>([]);
  const [metrics, setMetrics]         = useState<GraphMetrics | null>(null);

  useEffect(() => {
    getMetadados().then(m => setRegioes(m.regioes)).catch(() => {});
  }, []);

  const runQuery = useCallback(async (fn: () => Promise<GraphData>) => {
    setIsLoading(true);
    setError(null);
    setSelectedNode(null);
    setGraphData(null);
    setMetrics(null);
    try {
      const data = await fn();
      if (data.nodes.length === 0) setError('Nenhum resultado encontrado. Tente outro termo.');
      else setGraphData(data);
    } catch (e: any) {
      setError('Erro ao consultar os dados. Tente novamente.');
      console.error('[RedeView]', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const buscar = useCallback((m: Modo, v: string) => {
    if (!v.trim()) return;
    if (m === 'empresa')     runQuery(() => getRedeEmpresa(v));
    else if (m === 'regiao') runQuery(() => getRedeRegiao(v));
    else                     runQuery(() => getRedeQuery({ termo_busca: v }));
  }, [runQuery]);

  const buscarTema = useCallback((keywords: string[]) => {
    setModo('tema');
    runQuery(() => getRedeTema(keywords));
  }, [runQuery]);

  const expandirNo = useCallback((node: GraphNode) => {
    setSelectedNode(null);
    setQuery(node.label);
    if (node.type === 'municipio') {
      setModo('regiao');
      runQuery(() => getRedeRegiao(node.label));
    } else if (node.type === 'setor') {
      setModo('tema');
      runQuery(() => getRedeQuery({ setor: node.label }));
    } else {
      setModo('empresa');
      runQuery(() => getRedeEmpresa(node.label));
    }
  }, [runQuery]);

  const handleNodeSelect = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
  }, []);

  const handleCompareWith = useCallback((neighborId: string) => {
    // Just navigate to that node by selecting it
    if (!graphData) return;
    const node = graphData.nodes.find(n => n.id === neighborId);
    if (node) setSelectedNode(node);
  }, [graphData]);

  const placeholders: Record<Modo, string> = {
    empresa: 'Ex: Petrobras, Volkswagen, Hospital das Clínicas…',
    regiao:  `Ex: ${regioes[0] || 'Região Metropolitana de São Paulo'}`,
    tema:    'Palavras-chave livres ou use os atalhos abaixo',
  };

  const resetTab = (m: Modo) => {
    setModo(m); setQuery(''); setGraphData(null);
    setError(null); setSelectedNode(null); setMetrics(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Controls strip */}
      <div className="flex-shrink-0 px-8 pt-3 pb-4 bg-slate-950/70 border-b border-white/5 flex justify-center">
        <div className="relative flex flex-col items-center gap-1.5">

          <div className="flex items-center gap-3 bg-slate-800/70 border border-slate-700/50 rounded-xl px-4 py-2.5 shadow-lg">
            <div className="flex gap-1">
              {(['empresa', 'tema', 'regiao'] as Modo[]).map(m => (
                <button key={m} onClick={() => resetTab(m)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    modo === m
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}>
                  {{ empresa: 'Empresa', tema: 'Tema', regiao: 'Região' }[m]}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-slate-600/50" />
            <input type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar(modo, query)}
              placeholder={placeholders[modo]}
              className="w-72 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
            />
            <button onClick={() => buscar(modo, query)} disabled={isLoading || !query.trim()}
              className="px-5 py-1.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors shrink-0">
              {isLoading
                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                : 'Explorar'}
            </button>
          </div>

          {modo === 'tema' && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {TEMAS_RAPIDOS.map(t => (
                <button key={t.label} onClick={() => buscarTema(t.keywords)} disabled={isLoading}
                  className="px-2.5 py-1 rounded-lg text-[10px] bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-white hover:border-slate-500/50 transition-all disabled:opacity-40">
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="absolute left-full top-0 ml-4 flex flex-col items-center gap-0.5">
            <CapivaraPet
              state={graphData ? 'idle' : 'reading'}
              withGlasses={true}
              size={48}
              eyeAnim={graphData ? 'capivara-eye-graph 99s linear infinite' : undefined}
            />
            <span className="text-[9px] text-slate-600 whitespace-nowrap">PIESP</span>
          </div>
        </div>
      </div>

      {/* ── Graph area */}
      <div className="flex-1 relative overflow-hidden">

        {!graphData && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#040d18]">
            <p className="text-slate-500 text-sm select-none">
              Digite o nome de uma empresa, região ou tema para explorar a rede
            </p>
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/80 z-10">
            <CapivaraPet state="analyzing" withGlasses size={72} />
            <p className="text-slate-400 text-sm">Mapeando conexões…</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-[#040d18]">
            <CapivaraPet state="empty" size={72} />
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
        )}

        {graphData && !isLoading && (
          <GraphErrorBoundary onReset={() => { setGraphData(null); setError(null); }}>
            <GraphCanvas
              data={graphData}
              onNodeSelect={handleNodeSelect}
              onMetricsReady={setMetrics}
            />
          </GraphErrorBoundary>
        )}

        {/* Node detail panel */}
        {selectedNode && graphData && (
          <NodePanel
            node={selectedNode}
            graphData={graphData}
            metrics={metrics}
            isLoading={isLoading}
            onExpand={expandirNo}
            onClose={() => { setSelectedNode(null); handleNodeSelect(null); }}
            onCompareWith={handleCompareWith}
          />
        )}
      </div>
    </div>
  );
};

export default RedeView;
