import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';

export interface EmbeddedChartProps {
  type?: 'bar' | 'pie';
  title?: string;
  data?: { name: string; value: number }[];
}

const COLORS = [
  '#f43f5e', '#22d3ee', '#34d399', '#fbbf24', '#818cf8',
  '#f97316', '#a78bfa', '#fb7185', '#2dd4bf', '#e879f7',
];

export const EmbeddedChart: React.FC<EmbeddedChartProps> = ({ type = 'bar', title = 'Gráfico', data = [] }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 my-6 flex flex-col items-center w-full shadow-lg">
      <h4 className="text-slate-100 font-semibold mb-6 text-center text-sm md:text-base border-b border-slate-700/50 pb-3 w-full">
        {title}
      </h4>
      <div className="w-full h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickMargin={10}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                width={80}
              />
              <Tooltip
                cursor={{ fill: '#334155', opacity: 0.4 }}
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#f8fafc'
                }}
                itemStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#f8fafc'
                }}
                itemStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={50}
                stroke="#042a3a"
                strokeWidth={2}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
