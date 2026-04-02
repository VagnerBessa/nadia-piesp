
import React from 'react';
import { 
  Box, 
  Container, 
  Paper, 
  Typography, 
  Chip,
  IconButton,
  ThemeProvider,
  createTheme,
  CircularProgress
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SwitchModeIcon } from './Icons';
import SoundWaveIcon from './SoundWaveIcon';
import { NadiaSphere } from './NadiaSphere';
import { useLiveConnection } from '../hooks/useLiveConnection';
import { SYSTEM_INSTRUCTION } from '../utils/prompts';

// --- Data Constants ---
const PIB_DATA_CONTEXT = {
  referenceMonth: "Setembro 2025",
  publicationDate: "Dezembro 2025",
  highlights: {
    monthOverMonth: "-0,1%",
    accumulated12Months: "1,8%",
    yearOverYear: "0,6%",
    ytd2025: "1,4%"
  },
  // Data updated based on user input for "Evolução mensal"
  chartDataMonthly: [
     { month: 'Set 24', value: 0.9 }, 
     { month: 'Out', value: -0.3 }, 
     { month: 'Nov', value: -0.4 }, 
     { month: 'Dez', value: -1.6 }, 
     { month: 'Jan 25', value: 2.4 }, 
     { month: 'Fev', value: -0.4 }, 
     { month: 'Mar', value: 0.9 }, 
     { month: 'Abr', value: 0.7 }, 
     { month: 'Mai', value: -1.3 }, 
     { month: 'Jun', value: -0.2 }, 
     { month: 'Jul', value: 0.6 }, 
     { month: 'Ago', value: -0.5 }, 
     { month: 'Set 25', value: -0.1 }
  ],
  // Data updated based on user input for "Acumulado nos últimos 12 meses"
  chartData12Months: [
    { month: 'Set 24', value: 2.8 }, 
    { month: 'Out', value: 3.2 },
    { month: 'Nov', value: 3.3 }, 
    { month: 'Dez', value: 3.3 }, 
    { month: 'Jan 25', value: 3.4 },
    { month: 'Fev', value: 3.3 }, 
    { month: 'Mar', value: 3.5 }, 
    { month: 'Abr', value: 3.2 },
    { month: 'Mai', value: 3.1 }, 
    { month: 'Jun', value: 2.7 }, 
    { month: 'Jul', value: 2.3 }, 
    { month: 'Ago', value: 2.1 }, 
    { month: 'Set 25', value: 1.8 }
  ],
  // Data updated with user provided series
  chartDataYearOverYear: [
    { month: 'Set 24', value: 4.1 }, 
    { month: 'Out', value: 5.0 },
    { month: 'Nov', value: 2.3 }, 
    { month: 'Dez', value: 1.3 }, 
    { month: 'Jan 25', value: 3.4 },
    { month: 'Fev', value: 2.9 }, 
    { month: 'Mar', value: 2.1 }, 
    { month: 'Abr', value: 1.8 },
    { month: 'Mai', value: 2.0 }, 
    { month: 'Jun', value: -0.9 }, 
    { month: 'Jul', value: 1.4 }, 
    { month: 'Ago', value: -0.1 }, 
    { month: 'Set 25', value: 0.6 }
  ],
  // Data updated with user provided series
  chartDataYTD: [
    { month: 'Set 24', value: 3.5 }, 
    { month: 'Out', value: 3.7 },
    { month: 'Nov', value: 3.5 }, 
    { month: 'Dez', value: 3.3 }, 
    { month: 'Jan 25', value: 3.4 },
    { month: 'Fev', value: 3.2 }, 
    { month: 'Mar', value: 2.8 }, 
    { month: 'Abr', value: 2.5 },
    { month: 'Mai', value: 2.4 }, 
    { month: 'Jun', value: 1.8 }, 
    { month: 'Jul', value: 1.8 }, 
    { month: 'Ago', value: 1.5 }, 
    { month: 'Set 25', value: 1.4 }
  ]
};

// --- Futuristic Dark Crypto Theme ---
const cryptoTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: 'transparent',
      paper: 'rgba(2, 6, 23, 0.4)', // More transparent obsidian to show teal bg
    },
    text: {
      primary: '#f8fafc', // Slate 50
      secondary: '#94a3b8', // Slate 400
    },
    primary: { main: '#f43f5e' }, // Rose (Brand)
    secondary: { main: '#22d3ee' }, // Neon Cyan
    success: { main: '#34d399' }, // Emerald
    error: { main: '#f43f5e' }, // Rose
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h1: { fontWeight: 200, letterSpacing: '-0.02em' },
    h2: { fontWeight: 200, letterSpacing: '-0.01em' },
    h3: { fontWeight: 300, letterSpacing: '-0.02em', fontSize: '2rem' }, // Reduced size
    h4: { fontWeight: 300, letterSpacing: '-0.01em', fontSize: '1.5rem' }, // Reduced size
    h5: { fontWeight: 300 },
    h6: { fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.1em', color: '#64748b' },
    overline: { fontWeight: 500, letterSpacing: '0.2em', fontSize: '0.65rem', color: '#475569' },
    body1: { fontSize: '0.9rem', letterSpacing: '0.01em', fontWeight: 300 }, // Compact body
    body2: { fontSize: '0.8rem', fontWeight: 300, color: '#94a3b8' },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(0, 0, 0, 0.3)', 
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px', // Slightly smaller radius
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(34, 211, 238, 0.3)',
            boxShadow: '0 0 20px rgba(34, 211, 238, 0.1)',
          }
        },
      },
    },
    MuiChip: {
        styleOverrides: {
            root: {
                backgroundColor: 'rgba(34, 211, 238, 0.1)',
                border: '1px solid rgba(34, 211, 238, 0.3)',
                color: '#22d3ee',
                fontWeight: 600,
                borderRadius: '4px',
                height: '20px', // Smaller chip
                fontSize: '0.65rem'
            },
            label: {
                paddingLeft: 6,
                paddingRight: 6,
            }
        }
    }
  },
});

interface PibMensalViewProps {
  onNavigateHome: () => void;
}

// Compact Metric Card
const MetricCard = ({ label, value, desc, color }: { label: string, value: string, desc: string, color: string }) => (
    <Paper elevation={0} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography variant="overline" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1, lineHeight: 1 }}>
               <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 8px ${color}` }} />
               {label}
            </Typography>
        </Box>
        <Typography variant="h4" sx={{ color: '#fff', mb: 0, fontWeight: 300, letterSpacing: '-0.02em', textShadow: `0 0 20px ${color}40` }}>
            {value}
        </Typography>
        <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontFamily: 'monospace', mt: 0.5 }}>
            {desc}
        </Typography>
    </Paper>
);

const PibMensalView: React.FC<PibMensalViewProps> = ({ onNavigateHome }) => {
  const pibSystemInstruction = `
  ${SYSTEM_INSTRUCTION}

  **SITUAÇÃO ATUAL: MODO DE ANÁLISE TÉCNICA (DASHBOARD PIB MENSAL)**

  Você está conectada ao painel de "Dados do PIB" do Portal da Fundação Seade.
  Referência: **Setembro de 2025** (Publicado em Dezembro 2025).

  **CONTEXTO DE DADOS VISÍVEIS NA TELA (Use estes números exatos):**
  ${JSON.stringify(PIB_DATA_CONTEXT, null, 2)}

  **DIRETRIZES DE INTERPRETAÇÃO ECONÔMICA (OBRIGATÓRIO):**

  1. **Análise de Conjuntura (O que está acontecendo?):**
     - O PIB registrou **recuo de 0,1%** em setembro na comparação com o mês anterior (com ajuste sazonal), indicando estabilidade após um período de oscilação.
     - **Visão de Longo Prazo (Acumulado 12 meses):** O resultado ainda é positivo (**+1,8%**), mas mostra uma **desaceleração clara** quando olhamos o gráfico (vinha de 3,4% em jan/25 e agora está em 1,8%).
     - **Acumulado no Ano (YTD):** Crescimento de **1,4%** de janeiro a setembro.

  2. **Setorial (Se perguntarem):**
     - O resultado foi misto. No acumulado de 12 meses, Serviços (+1,9%) segura o índice, enquanto a Agropecuária (-4,3%) e Indústria (-0,3%) apresentam resultados negativos.

  3. **Postura:**
     - Seja técnica. Explique que o dado mensal (-0,1%) é volátil ("margem"), enquanto o acumulado (1,8%) mostra a tendência estrutural da economia paulista.
  `;

  const {
    isConnected,
    isSpeaking,
    isConnecting,
    audioLevel,
    startConversation,
    stopConversation
  } = useLiveConnection({ systemInstruction: pibSystemInstruction });

  const isListening = isConnected && !isSpeaking;

  return (
    <ThemeProvider theme={cryptoTheme}>
      <Box sx={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
        
        {/* Background Overlay */}
        <Box sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            zIndex: 0, 
            background: 'radial-gradient(circle at 80% 20%, rgba(34, 211, 238, 0.05), transparent 40%)',
            pointerEvents: 'none'
        }} />

        {/* Back Button - Absolute Positioned */}
         <IconButton 
            onClick={onNavigateHome} 
            sx={{ 
                position: 'absolute',
                top: 16,
                right: 24,
                zIndex: 20,
                bgcolor: 'rgba(15, 23, 42, 0.6)', 
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                backdropFilter: 'blur(4px)',
                '&:hover': { bgcolor: 'rgba(15, 23, 42, 0.8)' }
            }}
        >
            <SwitchModeIcon className="w-5 h-5" />
        </IconButton>

        {/* Scrollable Content Container */}
        <Box sx={{ height: '100%', overflowY: 'auto', pb: 2, position: 'relative', zIndex: 1 }} className="custom-scrollbar">
            {/* Reduced padding top/bottom */}
            <Container maxWidth="xl" sx={{ pt: 2, pb: 4 }}>
                
                {/* Header Section - COMPACT */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 items-center">
                    <div className="md:col-span-9">
                        <Box display="flex" alignItems="center" gap={2} mb={0.5}>
                             <Typography variant="overline" sx={{ color: '#22d3ee', textShadow: '0 0 10px rgba(34,211,238,0.5)' }}>
                                FUNDAÇÃO SEADE
                            </Typography>
                            <Chip label="DEZEMBRO 2025" size="small" />
                        </Box>
                        
                        <Box display="flex" alignItems="baseline" gap={2} flexWrap="wrap">
                            <Typography variant="h4" component="h1" sx={{ color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>
                                PIB Mensal
                            </Typography>
                             <Typography variant="body1" sx={{ fontSize: '1rem', color: '#e2e8f0', lineHeight: 1, fontWeight: 300 }}>
                                 Atividade em SP <span style={{ color: '#f43f5e', fontWeight: 600 }}>recua 0,1%</span> em setembro (vs. mês anterior).
                            </Typography>
                        </Box>
                    </div>

                    {/* Nadia Actions - Compact Layout */}
                    <div className="md:col-span-3 flex justify-center">
                        <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                            <NadiaSphere 
                                size="small"
                                isListening={isListening}
                                isSpeaking={isSpeaking}
                                isConnecting={isConnecting}
                                audioLevel={audioLevel}
                            />
                            <IconButton 
                                onClick={isConnected ? stopConversation : startConversation}
                                disabled={isConnecting}
                                sx={{ 
                                    padding: 1,
                                    bgcolor: 'rgba(255,255,255,0.05)',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                                }}
                            >
                                {isConnecting ? (
                                     <CircularProgress size={24} sx={{ color: '#f43f5e' }} />
                                ) : (
                                    <SoundWaveIcon 
                                        className="w-6 h-6 text-rose-500" 
                                        isListening={isListening} 
                                        isSpeaking={isSpeaking}
                                        audioLevel={audioLevel}
                                    />
                                )}
                            </IconButton>
                        </Box>
                    </div>
                </div>

                {/* KPI Grid - Compact Spacing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <MetricCard 
                            label="MENSAL (SET 25)" 
                            value={PIB_DATA_CONTEXT.highlights.monthOverMonth} 
                            desc="Variação Margem (c/ Ajuste)"
                            color="#f43f5e"
                        />
                    </div>
                    <div>
                        <MetricCard 
                            label="ACUM. 12 MESES" 
                            value={PIB_DATA_CONTEXT.highlights.accumulated12Months} 
                            desc="Tendência Longo Prazo"
                            color="#34d399"
                        />
                    </div>
                    <div>
                         <MetricCard 
                            label="NO ANO (2025)" 
                            value={PIB_DATA_CONTEXT.highlights.ytd2025} 
                            desc="Jan - Set (Acumulado)"
                            color="#22d3ee"
                        />
                    </div>
                    <div>
                        <MetricCard 
                            label="INTERANUAL" 
                            value={PIB_DATA_CONTEXT.highlights.yearOverYear} 
                            desc="Set 25 vs. Set 24"
                            color="#fbbf24"
                        />
                    </div>
                </div>

                {/* Charts Grid - Consolidated & Shorter Heights (240px) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Evolution Chart */}
                    <div>
                        <Paper sx={{ p: 2, height: '240px', display: 'flex', flexDirection: 'column' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                <Typography variant="h6" sx={{fontSize: '0.7rem'}}>Evolução Mensal (%)</Typography>
                                <Typography variant="overline" color="text.secondary" sx={{fontSize: '0.6rem'}}>COM AJUSTE SAZONAL</Typography>
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={PIB_DATA_CONTEXT.chartDataMonthly}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                                        <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} minTickGap={20} />
                                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={30} />
                                        <RechartsTooltip 
                                            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', padding: '8px' }}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="value" 
                                            stroke="#22d3ee" 
                                            strokeWidth={2}
                                            dot={{ r: 3, fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 2 }}
                                            activeDot={{ r: 5, fill: '#22d3ee' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>
                    </div>
                    
                    {/* Accumulated Chart */}
                    <div>
                        <Paper sx={{ p: 2, height: '240px', display: 'flex', flexDirection: 'column' }}>
                             <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                <Typography variant="h6" sx={{fontSize: '0.7rem'}}>Acumulado 12 Meses</Typography>
                                <Typography variant="overline" color="text.secondary" sx={{fontSize: '0.6rem'}}>TENDÊNCIA</Typography>
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={PIB_DATA_CONTEXT.chartData12Months}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                                        <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} minTickGap={20} />
                                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={30} domain={[0, 'auto']} />
                                        <RechartsTooltip 
                                            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', padding: '8px' }}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="value" 
                                            stroke="#22d3ee" 
                                            strokeWidth={2}
                                            dot={{ r: 3, fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 2 }}
                                            activeDot={{ r: 5, fill: '#22d3ee' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>
                    </div>

                    {/* YTD Chart */}
                    <div>
                        <Paper sx={{ p: 2, height: '240px', display: 'flex', flexDirection: 'column' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                <Typography variant="h6" sx={{fontSize: '0.7rem'}}>Acumulado no Ano (2025)</Typography>
                                <Typography variant="overline" color="text.secondary" sx={{fontSize: '0.6rem'}}>VS. ANO ANTERIOR</Typography>
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={PIB_DATA_CONTEXT.chartDataYTD}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                                        <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} minTickGap={20} />
                                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={30} domain={[0, 'auto']} />
                                        <RechartsTooltip 
                                            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', padding: '8px' }}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="value" 
                                            stroke="#22d3ee" 
                                            strokeWidth={2}
                                            dot={{ r: 3, fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 2 }}
                                            activeDot={{ r: 5, fill: '#22d3ee' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>
                    </div>

                    {/* Interannual Chart */}
                    <div>
                        <Paper sx={{ p: 2, height: '240px', display: 'flex', flexDirection: 'column' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                <Typography variant="h6" sx={{fontSize: '0.7rem'}}>Interanual Mensal</Typography>
                                <Typography variant="overline" color="text.secondary" sx={{fontSize: '0.6rem'}}>MÊS VS MÊS (ANO ANT.)</Typography>
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={PIB_DATA_CONTEXT.chartDataYearOverYear}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                                        <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} minTickGap={20} />
                                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={30} />
                                        <RechartsTooltip 
                                            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', padding: '8px' }}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="value" 
                                            stroke="#22d3ee" 
                                            strokeWidth={2}
                                            dot={{ r: 3, fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 2 }}
                                            activeDot={{ r: 5, fill: '#22d3ee' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>
                    </div>
                 </div>
            </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default PibMensalView;
