import React from 'react';
import { EmbeddedChart, EmbeddedChartProps } from './EmbeddedChart';

// ── Tipos das seções ────────────────────────────────────────────────────────

interface KpiCard {
  label: string;
  valor: string;
  detalhe?: string;
  tendencia?: 'up' | 'down' | 'neutral';
}

interface BarListItem {
  name: string;
  value: number;
  label?: string; // texto formatado exibido (ex: "R$ 2,1 bi")
}

interface KpiSection       { tipo: 'kpi-cards';     cards: KpiCard[] }
interface ChartSection     { tipo: 'chart';          chart: EmbeddedChartProps }
interface TabelaSection    { tipo: 'tabela';         titulo?: string; colunas: string[]; linhas: string[][] }
interface BarListSection   { tipo: 'bar-list';       titulo?: string; items: BarListItem[] }
interface TextoSection     { tipo: 'texto';          conteudo: string }

type DashboardSection = KpiSection | ChartSection | TabelaSection | BarListSection | TextoSection;

export interface DashboardData {
  titulo: string;
  subtitulo?: string;
  secoes: DashboardSection[];
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

const TrendIcon: React.FC<{ tendencia?: 'up' | 'down' | 'neutral' }> = ({ tendencia }) => {
  if (!tendencia || tendencia === 'neutral') return null;
  const isUp = tendencia === 'up';
  return (
    <span className={`text-xs font-bold ml-1 ${isUp ? 'text-emerald-400' : 'text-rose-500'}`}>
      {isUp ? '↑' : '↓'}
    </span>
  );
};

const KpiCards: React.FC<{ cards: KpiCard[] }> = ({ cards }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
    {cards.map((card, i) => (
      <div key={i} className="bg-slate-800/60 rounded-xl border border-slate-700/50 px-4 py-3">
        <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">{card.label}</p>
        <p className="text-xl font-bold text-white leading-tight flex items-baseline gap-0.5">
          {card.valor}
          <TrendIcon tendencia={card.tendencia} />
        </p>
        {card.detalhe && <p className="text-xs text-slate-500 mt-1">{card.detalhe}</p>}
      </div>
    ))}
  </div>
);

const BarList: React.FC<{ titulo?: string; items: BarListItem[] }> = ({ titulo, items }) => {
  if (!items || items.length === 0) return null;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="my-4">
      {titulo && <h4 className="text-sm font-semibold text-slate-300 mb-3">{titulo}</h4>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-4 text-right flex-shrink-0">{i + 1}</span>
            <div className="flex-grow">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-xs text-slate-300 truncate max-w-[60%]">{item.name}</span>
                <span className="text-xs font-semibold text-slate-200 flex-shrink-0 ml-2">
                  {item.label ?? item.value}
                </span>
              </div>
              <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Tabela: React.FC<{ titulo?: string; colunas: string[]; linhas: string[][] }> = ({ titulo, colunas, linhas }) => (
  <div className="my-4">
    {titulo && <h4 className="text-sm font-semibold text-slate-300 mb-2">{titulo}</h4>}
    <div className="overflow-x-auto rounded-xl border border-slate-700/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/80">
            {colunas.map((col, i) => (
              <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-800/20'}>
              {linha.map((cel, j) => (
                <td key={j} className="px-4 py-2.5 text-slate-300 text-xs">{cel}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const TextoAnalise: React.FC<{ conteudo: string }> = ({ conteudo }) => (
  <div className="my-4 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap border-l-2 border-rose-500/30 pl-4">
    {conteudo}
  </div>
);

// ── Componente principal ────────────────────────────────────────────────────

interface DynamicDashboardProps {
  data: DashboardData;
}

export const DynamicDashboard: React.FC<DynamicDashboardProps> = ({ data }) => (
  <div className="w-full space-y-4">
    <div className="border-b border-slate-700/50 pb-4">
      <h2 className="text-xl font-bold text-white">{data.titulo}</h2>
      {data.subtitulo && <p className="text-sm text-slate-400 mt-1">{data.subtitulo}</p>}
    </div>

    {data.secoes.map((secao, i) => {
      switch (secao.tipo) {
        case 'kpi-cards': return <KpiCards   key={i} cards={secao.cards} />;
        case 'chart':     return <EmbeddedChart key={i} {...secao.chart} />;
        case 'bar-list':  return <BarList    key={i} titulo={secao.titulo} items={secao.items} />;
        case 'tabela':    return <Tabela     key={i} titulo={secao.titulo} colunas={secao.colunas} linhas={secao.linhas} />;
        case 'texto':     return <TextoAnalise key={i} conteudo={secao.conteudo} />;
        default:          return null;
      }
    })}
  </div>
);

// ── Parser ──────────────────────────────────────────────────────────────────

export function parseDashboard(text: string): DashboardData | null {
  const match = text.match(/```json-dashboard\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim()) as DashboardData;
  } catch {
    return null;
  }
}
