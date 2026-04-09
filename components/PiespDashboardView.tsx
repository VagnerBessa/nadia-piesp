import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Chip,
  IconButton,
  ThemeProvider,
  createTheme,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from 'recharts';
import { SwitchModeIcon } from './Icons';
import SoundWaveIcon from './SoundWaveIcon';
import { NadiaSphere } from './NadiaSphere';
import { useLiveConnection } from '../hooks/useLiveConnection';
import { consultarPiespData, consultarAnunciosSemValor } from '../services/piespDataService';
import { SYSTEM_INSTRUCTION } from '../utils/prompts';
import { getDashboardData, getDashboardDataByYear, getDashboardContext, getAvailableYears } from '../services/piespDashboardData';

// --- Theme ---
const dashTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: 'transparent', paper: 'rgba(15, 23, 42, 0.5)' },
    text: { primary: '#f8fafc', secondary: '#94a3b8' },
    primary: { main: '#f43f5e' },
    secondary: { main: '#22d3ee' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h4: { fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.01em', color: '#fff' },
    h6: { fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.02em', textTransform: 'uppercase' as const, color: '#64748b' },
    overline: { fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.6rem', color: '#64748b' },
    body2: { fontSize: '0.75rem', fontWeight: 400 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          transition: 'all 0.3s ease',
          '&:hover': {
            border: '1px solid rgba(34, 211, 238, 0.2)',
            boxShadow: '0 0 20px rgba(34, 211, 238, 0.05)',
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' },
        bar: { borderRadius: 4 },
      },
    },
  },
});

// --- KPI Card ---
const KpiCard = ({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) => (
  <Paper elevation={0} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
    <Typography variant="overline" sx={{ display: 'flex', alignItems: 'center', gap: 1, lineHeight: 1 }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 8px ${color}` }} />
      {label}
    </Typography>
    <Typography variant="h4" sx={{ color: '#fff', mt: 0.5, fontWeight: 300, textShadow: `0 0 20px ${color}40` }}>
      {value}
    </Typography>
    <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontFamily: 'monospace', mt: 0.5 }}>
      {sub}
    </Typography>
  </Paper>
);

// --- Custom Pie Label ---
const renderPieLabel = ({ name, percent }: any) => {
  if (percent < 0.04) return null;
  return `${name} (${(percent * 100).toFixed(0)}%)`;
};

// --- Formatador de Valores ---
const formatValueShort = (val: number) => {
  if (val >= 1000) {
    return `R$ ${(val / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bi`;
  }
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} mi`;
};

// --- Tooltip Minimalista (sem redundância de nomes) ---
const MinimalTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    const formatted = val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return (
      <Paper elevation={0} sx={{ p: 1, bgcolor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px' }}>
        <Typography variant="body2" sx={{ color: '#22d3ee', fontWeight: 700, fontSize: '0.8rem' }}>
          R$ {formatted} milhões
        </Typography>
      </Paper>
    );
  }
  return null;
};

// --- Main Component ---
interface PiespDashboardViewProps {
  onNavigateHome: () => void;
}

const PiespDashboardView: React.FC<PiespDashboardViewProps> = ({ onNavigateHome }) => {
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const allData = getDashboardData();
  const years = getAvailableYears();
  // "Volume por Ano" sempre usa dados completos; demais gráficos filtram pelo ano selecionado
  const data = selectedYear ? getDashboardDataByYear(selectedYear) : allData;
  const context = getDashboardContext();

  const dashboardSystemInstruction = `
  ${SYSTEM_INSTRUCTION}

  **SITUAÇÃO ATUAL: O USUÁRIO ESTÁ OLHANDO PARA O DASHBOARD ANALÍTICO DA PIESP.**
  Abaixo estão os dados AGREGADOS que estão visíveis na tela.

  ${context}

  **MODO: ANALISTA SÊNIOR DE INVESTIMENTOS INDUSTRIAIS**
  - Interprete os gráficos de forma técnica. Conecte setores, regiões e tipos de investimento.
  - Se perguntarem sobre um setor ou município, use as ferramentas de consulta da PIESP para aprofundar.
  - Não repita números sem contexto — explique o que significam.
  `;

  const {
    isConnected,
    isSpeaking,
    isConnecting,
    audioLevel,
    startConversation,
    stopConversation,
  } = useLiveConnection({
    systemInstruction: dashboardSystemInstruction,
    onToolCall: async (toolCall) => {
      if (toolCall.name === 'consultar_projetos_piesp') {
        const { ano, municipio, termo_busca } = toolCall.args;
        const resultados = consultarPiespData({ ano, municipio, termo_busca });
        return { sucesso: true, total_investimentos: resultados.total, projetos: resultados.projetos };
      }
      if (toolCall.name === 'consultar_anuncios_sem_valor') {
        const { ano, municipio, termo_busca } = toolCall.args;
        const resultados = consultarAnunciosSemValor({ ano, municipio, termo_busca });
        return { sucesso: true, total_investimentos: resultados.total, projetos: resultados.projetos };
      }
      return { error: 'Tool não reconhecido' };
    },
  });

  const isListening = isConnected && !isSpeaking;

  // Consolidar "RMSP vs Interior" para o donut de concentração
  const concentracaoData = [
    { name: 'RMSP', value: data.rmspVsInterior.rmsp, color: '#f43f5e' },
    { name: 'Interior + Litoral', value: data.rmspVsInterior.interior, color: '#22d3ee' },
  ];

  return (
    <ThemeProvider theme={dashTheme}>
      <Box sx={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>

        {/* Background */}
        <Box sx={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
          background: 'radial-gradient(ellipse at 30% 10%, rgba(244, 63, 94, 0.06), transparent 60%), radial-gradient(ellipse at 70% 90%, rgba(34, 211, 238, 0.04), transparent 50%)',
          pointerEvents: 'none',
        }} />

        {/* Back Button */}
        <IconButton
          onClick={onNavigateHome}
          sx={{ position: 'absolute', top: 12, right: 24, zIndex: 20, bgcolor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
        >
          <SwitchModeIcon className="w-5 h-5" />
        </IconButton>

        {/* Scrollable Content */}
        <Box sx={{ height: '100%', overflowY: 'auto', pb: 2, position: 'relative', zIndex: 1 }} className="custom-scrollbar">
          <Container maxWidth="xl" sx={{ pt: 1.5, pb: 4 }}>

            {/* Header */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-5 items-center">
              <div className="md:col-span-9">
                <Box display="flex" alignItems="center" gap={2} mb={0.5}>
                  <Typography variant="overline" sx={{ color: '#f43f5e', textShadow: '0 0 10px rgba(244,63,94,0.5)', fontWeight: 800 }}>
                    PIESP — PESQUISA DE INVESTIMENTOS
                  </Typography>
                  <Chip label="DASHBOARD ANALÍTICO" size="small" sx={{ borderColor: '#22d3ee', color: '#22d3ee', height: 16, fontSize: '0.6rem' }} variant="outlined" />
                </Box>
                <Typography variant="h4" component="h1" sx={{ color: '#fff', fontSize: '1.6rem', mb: 0.5 }}>
                  Investimentos Anunciados no Estado de São Paulo
                </Typography>
                <Typography variant="body1" sx={{ color: '#94a3b8', maxWidth: '800px', fontSize: '0.9rem' }}>
                  Painel consolidado com dados da base PIESP. Valores em R$ milhões (preços correntes).
                </Typography>
              </div>

              {/* Nadia voice widget */}
              <div className="md:col-span-3 flex justify-center">
                <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                  <NadiaSphere size="small" isListening={isListening} isSpeaking={isSpeaking} isConnecting={isConnecting} audioLevel={audioLevel} />
                  <IconButton
                    onClick={isConnected ? stopConversation : startConversation}
                    disabled={isConnecting}
                    sx={{ padding: 1, bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                  >
                    {isConnecting
                      ? <CircularProgress size={20} sx={{ color: '#f43f5e' }} />
                      : <SoundWaveIcon className="w-5 h-5 text-rose-500" isListening={isListening} isSpeaking={isSpeaking} audioLevel={audioLevel} />
                    }
                  </IconButton>
                </Box>
              </div>
            </div>

            {/* Filtro de Ano */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 3 }}>
              <Typography variant="overline" sx={{ color: '#64748b', mr: 1 }}>ANO</Typography>
              <Chip
                label="Todos"
                size="small"
                onClick={() => setSelectedYear(null)}
                sx={{
                  borderColor: selectedYear === null ? '#f43f5e' : 'rgba(255,255,255,0.12)',
                  color: selectedYear === null ? '#f43f5e' : '#94a3b8',
                  bgcolor: selectedYear === null ? 'rgba(244,63,94,0.08)' : 'transparent',
                  fontWeight: selectedYear === null ? 700 : 400,
                }}
                variant="outlined"
              />
              {years.map(year => (
                <Chip
                  key={year}
                  label={year}
                  size="small"
                  onClick={() => setSelectedYear(year)}
                  sx={{
                    borderColor: selectedYear === year ? '#22d3ee' : 'rgba(255,255,255,0.12)',
                    color: selectedYear === year ? '#22d3ee' : '#94a3b8',
                    bgcolor: selectedYear === year ? 'rgba(34,211,238,0.08)' : 'transparent',
                    fontWeight: selectedYear === year ? 700 : 400,
                  }}
                  variant="outlined"
                />
              ))}
            </Box>

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div>
                <KpiCard label="VOLUME TOTAL" value={`R$ ${data.totalBilhoes} bi`} sub="Acumulado histórico" color="#f43f5e" />
              </div>
              <div>
                <KpiCard label="PROJETOS" value={data.totalProjetos.toLocaleString('pt-BR')} sub="Investimentos registrados" color="#22d3ee" />
              </div>
              <div>
                <KpiCard label="EMPRESAS" value={data.totalEmpresas.toLocaleString('pt-BR')} sub="Empresas distintas" color="#34d399" />
              </div>
              <div>
                <KpiCard label="MUNICÍPIOS" value={data.totalMunicipios.toLocaleString('pt-BR')} sub="Municípios com investimento" color="#fbbf24" />
              </div>
            </div>

            {/* Row 1: Volume por Ano + Mapa Setorial */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

              {/* Volume por Ano / Volume por Mês */}
              <div>
                <Paper sx={{ p: 2, height: '280px', display: 'flex', flexDirection: 'column' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h5">{selectedYear ? `Volume por Mês — ${selectedYear}` : 'Volume por Ano'}</Typography>
                    <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.6rem' }}>R$ MILHÕES</Typography>
                  </Box>
                  <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={selectedYear ? data.porMes : allData.porAno}
                        margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis
                          stroke="#64748b"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          width={75}
                          tickFormatter={(value) => value === 0 ? '0' : formatValueShort(value)}
                        />
                        <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<MinimalTooltip />} />
                        <Area type="monotone" dataKey="value" stroke="#f43f5e" fillOpacity={1} fill="url(#colorVolume)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </div>

              {/* Top Setores */}
              <div>
                <Paper sx={{ p: 2, height: '280px', display: 'flex', flexDirection: 'column' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h5">Mapa Setorial</Typography>
                    <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.6rem' }}>TOP 8 SETORES</Typography>
                  </Box>
                  <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={data.porSetor} margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" hide />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={120}
                          tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<MinimalTooltip />} />
                        <Bar dataKey="value" radius={4} barSize={16}>
                          {data.porSetor.map((entry, i) => (
                            <Cell key={i} fill={entry.color || '#334155'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </div>
            </div>

            {/* Row 2: Top Municípios + Concentração */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

              {/* Top 10 Municípios */}
              <div className="md:col-span-2">
                <Paper sx={{ p: 2, height: '300px', display: 'flex', flexDirection: 'column' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h5">Geografia dos Investimentos</Typography>
                    <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.6rem' }}>TOP 10 MUNICÍPIOS</Typography>
                  </Box>
                  <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={data.porMunicipio} margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" hide />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={110}
                          tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<MinimalTooltip />} />
                        <Bar dataKey="value" radius={4} barSize={18}>
                          {data.porMunicipio.map((entry, i) => (
                            <Cell key={i} fill={i === 0 ? '#f43f5e' : i < 3 ? '#22d3ee' : '#334155'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </div>

              {/* RMSP vs Interior + Tipo de investimento */}
              <div className="flex flex-col gap-4">
                {/* Concentração donut */}
                <Paper sx={{ p: 2, height: '140px', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h5" sx={{ mb: 0.5 }}>Concentração Espacial</Typography>
                  <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ width: 90, height: 90, flexShrink: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={concentracaoData}
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={40}
                            paddingAngle={3}
                            strokeWidth={0}
                          >
                            {concentracaoData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                    <Box>
                      {concentracaoData.map((item) => (
                        <Box key={item.name} display="flex" alignItems="center" gap={1} mb={0.5}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
                          <Typography variant="body2" sx={{ color: '#e2e8f0', fontSize: '0.75rem' }}>
                            {item.name}: <strong>R$ {(item.value / 1000).toFixed(1)} bi</strong>
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Paper>

                {/* Tipo de Investimento */}
                <Paper sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h5" sx={{ mb: 1 }}>Tipo de Investimento</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {data.porTipo.map((tipo) => {
                      const pct = data.totalProjetos > 0 ? (tipo.count! / data.totalProjetos) * 100 : 0;
                      return (
                        <Box key={tipo.name}>
                          <Box display="flex" justifyContent="space-between" mb={0.3}>
                            <Typography variant="body2" sx={{ color: '#e2e8f0', fontSize: '0.7rem', fontWeight: 600 }}>{tipo.name}</Typography>
                            <Typography variant="body2" sx={{ color: tipo.color, fontSize: '0.7rem', fontWeight: 700 }}>{tipo.count} ({pct.toFixed(0)}%)</Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              height: 4,
                              borderRadius: 2,
                              bgcolor: 'rgba(255,255,255,0.05)',
                              '& .MuiLinearProgress-bar': { bgcolor: tipo.color, borderRadius: 2 },
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              </div>
            </div>

            {/* Row 3: Top Empresas */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5">Perfil Empresarial — Top 10 Investidoras</Typography>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.6rem' }}>POR VOLUME ANUNCIADO (R$ MI)</Typography>
              </Box>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {data.porEmpresa.map((emp, i) => (
                  <Paper key={emp.name} elevation={0} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <Box sx={{
                      width: 32, height: 32, borderRadius: '8px',
                      bgcolor: `${emp.color}15`, color: emp.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${emp.color}30`,
                      fontWeight: 800, fontSize: '0.75rem',
                    }}>
                      {i + 1}º
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.72rem' }}>
                        {emp.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: emp.color, fontSize: '0.68rem', fontWeight: 700 }}>
                        R$ {(emp.value / 1000).toFixed(1)} bi
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.6rem', ml: 1 }}>
                        {emp.count} proj.
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </div>
            </Paper>

          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default PiespDashboardView;
