import React from 'react';
import { EmbeddedChart, EmbeddedChartProps } from './EmbeddedChart';

interface KpiCard {
  label: string;
  valor: string;
  detalhe?: string;
}

interface TabelaSection {
  tipo: 'tabela';
  titulo?: string;
  colunas: string[];
  linhas: string[][];
}

interface KpiSection {
  tipo: 'kpi-cards';
  cards: KpiCard[];
}

interface ChartSection {
  tipo: 'chart';
  chart: EmbeddedChartProps;
}

interface TextoSection {
  tipo: 'texto';
  conteudo: string;
}

type DashboardSection = KpiSection | ChartSection | TabelaSection | TextoSection;

export interface DashboardData {
  titulo: string;
  subtitulo?: string;
  secoes: DashboardSection[];
}

interface DynamicDashboardProps {
  data: DashboardData;
}

const KpiCards: React.FC<{ cards: KpiCard[] }> = ({ cards }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
    {cards.map((card, i) => (
      <div key={i} className="bg-slate-800/60 rounded-xl border border-slate-700/50 px-4 py-3">
        <p className="text-xs text-slate-400 mb-1">{card.label}</p>
        <p className="text-xl font-bold text-white leading-tight">{card.valor}</p>
        {card.detalhe && <p className="text-xs text-slate-500 mt-1">{card.detalhe}</p>}
      </div>
    ))}
  </div>
);

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
                <td key={j} className="px-4 py-2.5 text-slate-300 text-xs">
                  {cel}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const TextoAnalise: React.FC<{ conteudo: string }> = ({ conteudo }) => (
  <div className="my-4 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
    {conteudo}
  </div>
);

export const DynamicDashboard: React.FC<DynamicDashboardProps> = ({ data }) => {
  return (
    <div className="w-full space-y-4">
      {/* Cabeçalho do dashboard */}
      <div className="border-b border-slate-700/50 pb-4">
        <h2 className="text-xl font-bold text-white">{data.titulo}</h2>
        {data.subtitulo && <p className="text-sm text-slate-400 mt-1">{data.subtitulo}</p>}
      </div>

      {/* Seções geradas dinamicamente */}
      {data.secoes.map((secao, i) => {
        if (secao.tipo === 'kpi-cards') return <KpiCards key={i} cards={secao.cards} />;
        if (secao.tipo === 'chart') return <EmbeddedChart key={i} {...secao.chart} />;
        if (secao.tipo === 'tabela') return <Tabela key={i} titulo={secao.titulo} colunas={secao.colunas} linhas={secao.linhas} />;
        if (secao.tipo === 'texto') return <TextoAnalise key={i} conteudo={secao.conteudo} />;
        return null;
      })}
    </div>
  );
};

/**
 * Extrai o primeiro bloco ```json-dashboard``` de uma resposta do modelo.
 */
export function parseDashboard(text: string): DashboardData | null {
  const match = text.match(/```json-dashboard\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim()) as DashboardData;
  } catch {
    return null;
  }
}
