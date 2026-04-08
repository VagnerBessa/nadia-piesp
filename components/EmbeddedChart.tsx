import React from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, CartesianGrid, Legend,
} from 'recharts';

export interface EmbeddedChartProps {
  type?: 'bar' | 'pie' | 'line' | 'area' | 'bar-horizontal' | 'composed';
  title?: string;
  data?: { name: string; value: number; linha?: number }[];
}

const COLORS = [
  '#f43f5e', '#22d3ee', '#34d399', '#fbbf24', '#818cf8',
  '#f97316', '#a78bfa', '#fb7185', '#2dd4bf', '#e879f7',
];

const TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #475569',
  borderRadius: '0.5rem',
  fontSize: '12px',
  color: '#f8fafc',
};

const AXIS_PROPS = {
  stroke: '#64748b',
  tick: { fill: '#94a3b8', fontSize: 11 },
};

const PIE_MAX_SLICES = 5;

// ── Formatadores pt-BR ──

/** Formata valor numérico com R$, pontos e sufixo mi/bi para eixos e tooltips */
function formatValueShort(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const bi = value / 1000;
    return `R$ ${bi.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bi`;
  }
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mi`;
}

/** Tooltip customizado que exibe valores formatados em pt-BR */
const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{
      backgroundColor: '#0f172a',
      border: '1px solid #334155',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '12px',
    }}>
      <p style={{ color: '#94a3b8', margin: 0, marginBottom: '4px', fontWeight: 600 }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color || '#22d3ee', margin: 0, fontWeight: 700 }}>
          {entry.name === 'value' || entry.name === 'Valor (R$ mi)'
            ? formatValueShort(entry.value)
            : `${entry.name}: ${formatValueShort(entry.value)}`}
        </p>
      ))}
    </div>
  );
};

/** Guardrail: agrupa fatias excedentes em "Outros" para manter a pizza legível. */
function capPieData(data: { name: string; value: number }[]): { name: string; value: number }[] {
  if (data.length <= PIE_MAX_SLICES) return data;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, PIE_MAX_SLICES - 1);
  const outrosValue = sorted.slice(PIE_MAX_SLICES - 1).reduce((acc, d) => acc + d.value, 0);
  return [...top, { name: 'Outros', value: Math.round(outrosValue) }];
}

/** Label customizado para o pie chart que posiciona texto fora da fatia com linhas */
const renderPieLabel = ({
  cx, cy, midAngle, outerRadius, name, percent,
}: any) => {
  if (percent < 0.03) return null; // Esconde labels de fatias menores que 3%
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 25;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x} y={y}
      fill="#cbd5e1"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${name} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};

/** Tooltip customizado para pie chart mostrando R$ */
const PieTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div style={{
      backgroundColor: '#0f172a',
      border: '1px solid #334155',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '12px',
    }}>
      <p style={{ color: '#94a3b8', margin: 0, marginBottom: '4px', fontWeight: 600 }}>{entry.name}</p>
      <p style={{ color: entry.payload.fill || '#f43f5e', margin: 0, fontWeight: 700 }}>
        {formatValueShort(entry.value)} ({(entry.payload.percent * 100).toFixed(1)}%)
      </p>
    </div>
  );
};

export const EmbeddedChart: React.FC<EmbeddedChartProps> = ({ type = 'bar', title = 'Gráfico', data = [] }) => {
  if (!data || data.length === 0) return null;

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <XAxis dataKey="name" {...AXIS_PROPS} tickMargin={10} />
            <YAxis {...AXIS_PROPS} width={85} tickFormatter={formatValueShort} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        );

      case 'bar-horizontal':
        return (
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <XAxis type="number" {...AXIS_PROPS} width={60} tickFormatter={formatValueShort} />
            <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={130} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <XAxis dataKey="name" {...AXIS_PROPS} tickMargin={10} />
            <YAxis {...AXIS_PROPS} width={85} tickFormatter={formatValueShort} />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={3}
              dot={{ fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#34d399', stroke: '#0f172a' }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" {...AXIS_PROPS} tickMargin={10} />
            <YAxis {...AXIS_PROPS} width={85} tickFormatter={formatValueShort} />
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2.5}
              fill="url(#areaGradient)"
              dot={{ fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 2, r: 3 }}
            />
          </AreaChart>
        );

      case 'composed':
        return (
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <XAxis dataKey="name" {...AXIS_PROPS} tickMargin={10} />
            <YAxis {...AXIS_PROPS} width={85} tickFormatter={formatValueShort} />
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="value" name="Valor (R$ mi)" fill="#f43f5e" radius={[4, 4, 0, 0]} opacity={0.85} />
            {data.some(d => d.linha !== undefined) && (
              <Line
                type="monotone" dataKey="linha" name="Tendência" stroke="#22d3ee"
                strokeWidth={2.5} dot={{ r: 4, fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 2 }}
              />
            )}
          </ComposedChart>
        );

      case 'pie': {
        const pieData = capPieData(data);
        // Calcula percentuais para uso no label
        const total = pieData.reduce((s, d) => s + d.value, 0);
        const pieDataWithPercent = pieData.map(d => ({ ...d, percent: total > 0 ? d.value / total : 0 }));
        return (
          <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Tooltip content={<PieTooltip />} />
            <Pie
              data={pieDataWithPercent} dataKey="value" nameKey="name"
              cx="50%" cy="50%" outerRadius={80} innerRadius={45}
              stroke="#042a3a" strokeWidth={2}
              label={renderPieLabel}
              labelLine={{ stroke: '#475569', strokeWidth: 1 }}
            >
              {pieDataWithPercent.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
          </PieChart>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 my-4 flex flex-col items-center w-full shadow-lg">
      <h4 className="text-slate-100 font-semibold mb-5 text-center text-sm md:text-base border-b border-slate-700/50 pb-3 w-full">
        {title}
      </h4>
      <div className="w-full h-64 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart() as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

