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

const ITEM_STYLE = { color: '#e2e8f0', fontWeight: 'bold' as const };

const AXIS_PROPS = {
  stroke: '#64748b',
  tick: { fill: '#94a3b8', fontSize: 11 },
};

export const EmbeddedChart: React.FC<EmbeddedChartProps> = ({ type = 'bar', title = 'Gráfico', data = [] }) => {
  if (!data || data.length === 0) return null;

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <XAxis dataKey="name" {...AXIS_PROPS} tickMargin={10} />
            <YAxis {...AXIS_PROPS} width={80} />
            <Tooltip cursor={{ fill: '#334155', opacity: 0.4 }} contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        );

      case 'bar-horizontal':
        return (
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <XAxis type="number" {...AXIS_PROPS} width={60} />
            <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={130} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <XAxis dataKey="name" {...AXIS_PROPS} tickMargin={10} />
            <YAxis {...AXIS_PROPS} width={80} />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} />
            <Line
              type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={3}
              dot={{ fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#34d399', stroke: '#0f172a' }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" {...AXIS_PROPS} tickMargin={10} />
            <YAxis {...AXIS_PROPS} width={80} />
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} />
            <Area
              type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2.5}
              fill="url(#areaGradient)"
              dot={{ fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 2, r: 3 }}
            />
          </AreaChart>
        );

      case 'composed':
        return (
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: -20, bottom: 20 }}>
            <XAxis dataKey="name" {...AXIS_PROPS} tickMargin={10} />
            <YAxis {...AXIS_PROPS} width={80} />
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} />
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

      case 'pie':
        return (
          <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} />
            <Pie
              data={data} dataKey="value" nameKey="name"
              cx="50%" cy="50%" outerRadius={90} innerRadius={50}
              stroke="#042a3a" strokeWidth={2}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={false}
            >
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
          </PieChart>
        );

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
