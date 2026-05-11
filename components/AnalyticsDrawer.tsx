import React, { useState } from 'react';
import { GraphMetrics, RankedNode, COMMUNITY_PALETTE } from '../utils/graphAnalytics';
import { GROUP_COLORS } from './GraphCanvas';

interface Props {
  metrics: GraphMetrics;
  nodes: Array<{ id: string; label: string; group: string }>;
  onHighlight: (ids: Set<string> | null) => void;
  onClose: () => void;
}

const GROUP_PT: Record<string, string> = {
  investidora: 'Investidora', empresa_alvo: 'Empresa alvo',
  municipio: 'Município', setor: 'Setor',
};

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 4;
  return (
    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function RankList({ items, colorKey, fmt }: {
  items: RankedNode[];
  colorKey: 'group' | 'community';
  fmt: (v: number) => string;
}) {
  const max = items[0]?.value ?? 1;
  return (
    <div className="flex flex-col gap-1">
      {items.map((item, i) => {
        const color = colorKey === 'community'
          ? COMMUNITY_PALETTE[i % COMMUNITY_PALETTE.length]
          : GROUP_COLORS[item.group] ?? '#94a3b8';
        return (
          <div key={item.id} className="flex items-center gap-2">
            <span className="text-[9px] text-slate-600 w-3 text-right">{i + 1}</span>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[11px] text-slate-300 flex-1 truncate">{item.label}</span>
            <span className="text-[10px] text-slate-500 flex-shrink-0 font-mono">{fmt(item.value)}</span>
            <Bar value={item.value} max={max} color={color} />
          </div>
        );
      })}
    </div>
  );
}

type RankTab = 'grau' | 'valor' | 'centralidade';

const QUESTIONS = [
  { id: 'top-degree',  label: 'Nós mais centrais' },
  { id: 'bridges',     label: 'Nós ponte' },
  { id: 'peripheral',  label: 'Alto valor, baixa conectividade' },
  { id: 'territorial', label: 'Concentração territorial?' },
  { id: 'density',     label: 'Quão densa é a rede?' },
  { id: 'communities', label: 'Quais agrupamentos existem?' },
] as const;

type QuestionId = typeof QUESTIONS[number]['id'];

export const AnalyticsDrawer: React.FC<Props> = ({ metrics, nodes, onHighlight, onClose }) => {
  const [rankTab, setRankTab] = useState<RankTab>('grau');
  const [activeQ, setActiveQ]  = useState<QuestionId | null>(null);

  const getNodeLabel = (id: string) => nodes.find(n => n.id === id)?.label ?? id;

  function handleQuestion(q: QuestionId) {
    if (activeQ === q) { setActiveQ(null); onHighlight(null); return; }
    setActiveQ(q);
    if (q === 'top-degree') onHighlight(new Set(metrics.topByDegree.map(n => n.id)));
    else if (q === 'bridges') onHighlight(metrics.bridges.length ? new Set(metrics.bridges) : null);
    else if (q === 'peripheral') onHighlight(metrics.peripheralHighValue.length ? new Set(metrics.peripheralHighValue) : null);
    else onHighlight(null);
  }

  function getAnswer(q: QuestionId): string {
    switch (q) {
      case 'top-degree': {
        const top = metrics.topByDegree.slice(0, 3);
        if (!top.length) return 'Sem dados suficientes.';
        return `Os nós mais conectados são: ${top.map(n => `${n.label} (${n.value} conexões)`).join(', ')}.`;
      }
      case 'bridges': {
        if (!metrics.bridges.length) return 'Nenhum nó com papel claro de ponte foi identificado no recorte.';
        const names = metrics.bridges.map(getNodeLabel);
        return `${names.slice(0, 3).join(', ')} ${metrics.bridges.length > 1 ? 'funcionam' : 'funciona'} como ponte — removê-los fragmentaria a rede.`;
      }
      case 'peripheral': {
        if (!metrics.peripheralHighValue.length) return 'Nenhum nó periférico com valor relevante encontrado.';
        const names = metrics.peripheralHighValue.map(getNodeLabel);
        return `${names.slice(0, 3).join(', ')} têm poucas conexões no recorte, mas valor de investimento acima da mediana.`;
      }
      case 'territorial':
        return metrics.territorialConcentration || 'Sem municípios suficientes para análise de concentração territorial.';
      case 'density':
        return `Densidade: ${(metrics.density * 100).toFixed(1)}% das conexões possíveis estão presentes. `
          + (metrics.density > 0.4 ? 'Rede densa — alta interconexão entre os nós visíveis.'
          : metrics.density > 0.15 ? 'Rede moderadamente conectada.'
          : 'Rede esparsa — conexões concentradas em poucos nós.');
      case 'communities':
        if (metrics.communityCount <= 1) return 'A rede forma um único agrupamento coeso no recorte atual.';
        return `Foram detectados ${metrics.communityCount} agrupamentos estruturais. Eles podem indicar subconjuntos temáticos ou territoriais — mas agrupamentos estruturais não equivalem necessariamente a cadeias produtivas reais.`;
    }
  }

  const rankItems: Record<RankTab, RankedNode[]> = {
    grau: metrics.topByDegree,
    valor: metrics.topByVal,
    centralidade: metrics.topByBetweenness,
  };
  const rankFmt: Record<RankTab, (v: number) => string> = {
    grau: v => `${v}`,
    valor: v => v.toFixed(1),
    centralidade: v => v.toFixed(3),
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/97 border-r border-slate-700/40 text-sm overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <div>
          <p className="text-[11px] font-semibold text-slate-200">Análise do recorte</p>
          <p className="text-[9px] text-slate-500">{metrics.totalNodes} nós · {metrics.totalLinks} conexões</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Síntese */}
        <div className="px-4 py-3 border-b border-slate-700/30">
          <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-2">Síntese</p>
          <p className="text-[11px] text-slate-300 leading-relaxed">{metrics.synthesis}</p>
        </div>

        {/* ── Métricas-chave */}
        <div className="px-4 py-3 border-b border-slate-700/30">
          <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-2">Métricas-chave</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Nós', value: `${metrics.totalNodes}` },
              { label: 'Conexões', value: `${metrics.totalLinks}` },
              { label: 'Densidade', value: `${(metrics.density * 100).toFixed(0)}%` },
              { label: 'Agrupamentos', value: `${metrics.communityCount}` },
              { label: 'Sub-redes', value: `${metrics.components}` },
              { label: 'Grau mediano', value: `${metrics.medianDegree.toFixed(1)}` },
            ].map(m => (
              <div key={m.label} className="bg-slate-800/50 rounded-lg p-2 text-center">
                <p className="text-[9px] text-slate-500 truncate">{m.label}</p>
                <p className="text-[12px] font-semibold text-slate-200">{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Rankings */}
        <div className="px-4 py-3 border-b border-slate-700/30">
          <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-2">Rankings (top 5)</p>
          <div className="flex gap-1 mb-3">
            {(['grau', 'valor', 'centralidade'] as RankTab[]).map(tab => (
              <button key={tab} onClick={() => setRankTab(tab)}
                className={`flex-1 py-1 rounded-md text-[9px] font-medium transition-all capitalize ${
                  rankTab === tab
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'text-slate-500 hover:text-slate-300 bg-slate-800/40'
                }`}>
                {tab}
              </button>
            ))}
          </div>
          <RankList
            items={rankItems[rankTab]}
            colorKey="group"
            fmt={rankFmt[rankTab]}
          />
          {rankTab === 'centralidade' && (
            <p className="text-[9px] text-slate-600 mt-2 italic">
              Centralidade de intermediação: mede o papel de ponte entre agrupamentos.
            </p>
          )}
          {rankTab === 'valor' && (
            <p className="text-[9px] text-slate-600 mt-2 italic">
              Valor proporcional ao porte do investimento anunciado.
            </p>
          )}
        </div>

        {/* ── Perguntas analíticas */}
        <div className="px-4 py-3 border-b border-slate-700/30">
          <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-2">Explorar</p>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {QUESTIONS.map(q => (
              <button key={q.id} onClick={() => handleQuestion(q.id)}
                className={`px-2 py-1.5 rounded-lg text-[10px] text-left leading-tight transition-all border ${
                  activeQ === q.id
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-slate-800/50 border-slate-700/30 text-slate-400 hover:text-white hover:border-slate-600/50'
                }`}>
                {q.label}
              </button>
            ))}
          </div>
          {activeQ && (
            <div className="bg-slate-800/60 border border-slate-700/30 rounded-lg p-2.5">
              <p className="text-[11px] text-slate-300 leading-relaxed">{getAnswer(activeQ)}</p>
            </div>
          )}
        </div>

        {/* ── Cuidados metodológicos */}
        <details className="px-4 py-3">
          <summary className="text-[9px] uppercase tracking-wider text-slate-600 cursor-pointer select-none hover:text-slate-400 transition-colors">
            Cuidados metodológicos ▾
          </summary>
          <ul className="mt-2 space-y-1.5">
            {[
              'Esta análise refere-se ao recorte filtrado, não ao universo completo da Piesp.',
              'Centralidade indica posição na rede, não importância econômica absoluta.',
              'Agrupamentos são estruturais — não equivalem a cadeias produtivas ou vínculos contratuais.',
              'Conexões representam relações derivadas de anúncios, não vínculos societários.',
              'Evite inferências causais a partir da estrutura do grafo.',
            ].map((t, i) => (
              <li key={i} className="flex gap-1.5 text-[10px] text-slate-500 leading-snug">
                <span className="text-slate-600 flex-shrink-0 mt-0.5">–</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </details>

      </div>
    </div>
  );
};

export default AnalyticsDrawer;
