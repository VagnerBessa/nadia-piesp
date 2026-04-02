
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
  CircularProgress,
  LinearProgress,
  Stack
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
  LabelList
} from 'recharts';
import { SwitchModeIcon } from './Icons';
import SoundWaveIcon from './SoundWaveIcon';
import { NadiaSphere } from './NadiaSphere';
import { useLiveConnection } from '../hooks/useLiveConnection';
import { SYSTEM_INSTRUCTION } from '../utils/prompts';

// --- RICH DATA CONTEXT ---
const ECONOMIC_DATA = {
  referenceDate: "Novembro 2025",
  narrative: "A economia aponta para estabilidade: o PIB deve crescer 1,6% em 2025 e manter ritmo semelhante em 2026 (1,5%). O grande destaque é social: o desemprego atinge o menor nível da história e a renda das famílias continua subindo.",
  pib: {
    2025: { value: 1.6, label: "PIB 2025 (Projeção)", context: "Crescimento Estável" },
    2026: { value: 1.5, label: "PIB 2026 (Projeção)", context: "Manutenção do Ritmo" },
  },
  sectors: {
    data: [
      { name: 'Serviços', value: 4.6, color: '#34d399', desc: 'Estável' }, 
      { name: 'Varejo', value: 1.2, color: '#34d399', desc: 'Desacelerou' }, 
      { name: 'Indústria', value: -0.9, color: '#f43f5e', desc: 'Negativo' }, 
      { name: 'Varejo Ampliado', value: -2.4, color: '#f43f5e', desc: 'Queda' }, 
    ],
  },
  investments: {
    total2025: "106,8",
    total2024: "164,6", 
    drop: "-35,1%",
    narrative: "Forte base de comparação com 2024 (ano atípico).",
    sectors: [
        { name: 'Infraestrutura', value: 60.6, share: 56.7, prev: 74.7, color: '#fbbf24' }, // Amber
        { name: 'Indústria', value: 23.0, share: 21.5, prev: 47.5, color: '#22d3ee' }, // Cyan
        { name: 'Serviços', value: 9.4, share: 8.8, prev: 33.9, color: '#f43f5e' }, // Rose
        { name: 'Outros', value: 13.8, share: 13.0, prev: 8.5, color: '#94a3b8' } // Slate
    ],
    // Updated destinations to include Inter-regional investments
    topDestinations: ["RMSP (45%)", "Inter-reg. (20%)", "Campinas (12%)", "Vale do Paraíba (8%)"]
  },
  labor: {
    unemployment: "5,4%",
    unemploymentTrend: "Mínima Histórica",
    occupiedPop: "24,3 mi",
    occupiedPopTrend: "Recorde da Série",
    formalJobs: "13,6 mi",
    formalJobsTrend: "+3,1% (CLT)",
    informality: "29,8%",
    informalityTrend: "Queda 0.5%",
    incomeMass: "R$ 102 Bi",
    incomeGrowth: "+7,8% (Anual)",
    avgIncome: "R$ 4.180",
    avgIncomeTrend: "Estável",
    participation: "65,2%",
    participationTrend: "Pop. Ativa",
    underutilization: "15,1%",
    underutilizationTrend: "Menor nível"
  },
  inflation: {
    data: [
        { name: 'Brasil', value: 4.7, fill: '#64748b' },
        { name: 'São Paulo', value: 5.2, fill: '#f43f5e' }
    ], 
    sectors: "Alimentação, Educação e Transportes" 
  }
};

// --- THEME ---
const cryptoTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: 'transparent', paper: 'rgba(15, 23, 42, 0.6)' },
    text: { primary: '#f8fafc', secondary: '#94a3b8' },
    primary: { main: '#f43f5e' }, 
    secondary: { main: '#22d3ee' }, 
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h5: { fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.01em', color: '#fff' },
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
        },
      },
    },
    MuiLinearProgress: {
        styleOverrides: {
            root: { borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' },
            bar: { borderRadius: 4 }
        }
    }
  },
});

// --- HELPER ICONS FOR SECTORS ---
const getSectorIcon = (name: string, color: string) => {
    const props = { width: 22, height: 22, strokeWidth: 1.5 };
    switch (name) {
        case 'Infraestrutura': 
            return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>;
        case 'Indústria':
            return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" transform="scale(-1,1) translate(-24,0)"/><path strokeLinecap="round" strokeLinejoin="round" d="M6 13.5V3.75m0 9.75a1.5 1.5 0 0 1 1.5 1.5m-1.5-1.5a1.5 1.5 0 0 0-1.5 1.5m1.5-1.5v2.25m1.5-3.75a1.5 1.5 0 0 1-1.5 1.5m1.5-1.5v2.25m-1.5 1.5a1.5 1.5 0 0 1-1.5-1.5" /><path d="M9 6l3-3 3 3M18 6l-3-3" /></svg>;
        case 'Serviços':
            return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>;
        default:
             return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>;
    }
}

// --- CUSTOM VISUAL COMPONENTS ---

const MiniKpi = ({ label, value, trend, color = "#fff", subLabel }: any) => (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: color }} />
        <Typography variant="overline" sx={{ color: '#94a3b8', lineHeight: 1.2, fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.05em' }}>{label}</Typography>
        <Box display="flex" alignItems="baseline" gap={1} mt={0.5}>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.5rem !important' }}>{value}</Typography>
        </Box>
        {trend && (
            <Typography variant="caption" sx={{ 
                color: trend.includes('Queda') || trend.includes('Negativo') ? '#f43f5e' : color, 
                fontWeight: 600, 
                fontSize: '0.7rem',
                mt: 0.5,
                display: 'block'
            }}>
                {trend}
            </Typography>
        )}
        {subLabel && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', mt: 0.2, display: 'block' }}>{subLabel}</Typography>}
    </Paper>
);

const ChartCard = ({ title, subtitle, children, height = 240, footerSource }: any) => (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box mb={2}>
            <Typography variant="h5">{title}</Typography>
            {subtitle && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>{subtitle}</Typography>}
        </Box>
        <Box sx={{ flexGrow: 1, minHeight: height, position: 'relative' }}>
            {children}
        </Box>
        {footerSource && (
            <Box mt={2} pt={1} borderTop="1px solid rgba(255,255,255,0.05)">
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Fonte: {footerSource}</Typography>
            </Box>
        )}
    </Paper>
);

interface ProjecaoViewProps {
  onNavigateHome: () => void;
}

const ProjecaoView: React.FC<ProjecaoViewProps> = ({ onNavigateHome }) => {
  const systemInstruction = `
  ${SYSTEM_INSTRUCTION}

  **SITUAÇÃO ATUAL: O USUÁRIO ESTÁ OLHANDO PARA O DASHBOARD DE PROJEÇÕES ECONÔMICAS.**
  Abaixo estão os dados EXATOS que estão visíveis na tela para o usuário agora.
  
  --- DADOS DO DASHBOARD VISÍVEL (JSON) ---
  ${JSON.stringify(ECONOMIC_DATA, null, 2)}
  -----------------------------------------

  **MODO: ANALISTA MACROECONÔMICO SÊNIOR (COMENTÁRIOS APROFUNDADOS)**
  
  **SUA NOVA DIRETRIZ DE ESTILO (ESPECÍFICA PARA ESTA TELA):**
  Neste painel, **IGNORE a diretriz geral de ser "breve"**. O usuário quer análise técnica e contexto, não apenas a leitura de um número.
  
  **COMO AGIR:**
  1.  **Não seja um papagaio de dados:** Se perguntarem sobre o PIB, não diga apenas "É 1,6%". Diga: "Projetamos 1,6%, o que indica um cenário de estabilização. Isso reflete um ano de ajustes, mas sustentado pelo consumo das famílias."
  2.  **Conecte os pontos (Correlação):** Explique a relação entre os gráficos. 
      *   *Exemplo:* "Embora os investimentos tenham caído 35% (devido a uma base de comparação atípica em 2024), note como o mercado de trabalho compensa isso: o desemprego está na mínima histórica de 5,4%, o que segura a renda e o consumo."
  3.  **Contextualize com a Base de Conhecimento:** Use as informações detalhadas do relatório "Conjuntura Econômica" (que você tem na memória) para enriquecer a resposta. Fale sobre quais setores da indústria estão puxando para baixo ou quais serviços estão crescendo.
  
  **MANTENHA A NEUTRALIDADE TÉCNICA:**
  Continue não emitindo opinião política (se é "bom" ou "ruim" politicamente), mas seja **profunda** na análise técnica (expansão, contração, causas macroeconômicas e efeitos no emprego).
  `;

  const {
    isConnected,
    isSpeaking,
    isConnecting,
    audioLevel,
    startConversation,
    stopConversation
  } = useLiveConnection({ systemInstruction });

  const isListening = isConnected && !isSpeaking;

  return (
    <ThemeProvider theme={cryptoTheme}>
      <Box sx={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
        
        {/* Background Overlay */}
        <Box sx={{ 
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, 
            background: 'radial-gradient(ellipse at 50% 0%, rgba(34, 211, 238, 0.1), transparent 70%)',
            pointerEvents: 'none'
        }} />

        <IconButton 
            onClick={onNavigateHome} 
            sx={{ position: 'absolute', top: 12, right: 24, zIndex: 20, bgcolor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
        >
            <SwitchModeIcon className="w-5 h-5" />
        </IconButton>

        <Box sx={{ height: '100%', overflowY: 'auto', pb: 2, position: 'relative', zIndex: 1 }} className="custom-scrollbar">
            <Container maxWidth="xl" sx={{ pt: 1.5, pb: 4 }}>
                
                {/* Header Narrative */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6 items-center">
                    <div className="md:col-span-9">
                        <Box display="flex" alignItems="center" gap={2}>
                             <Typography variant="overline" sx={{ color: '#22d3ee' }}>FUNDAÇÃO SEADE</Typography>
                             <Chip label="NOVEMBRO 2025" size="small" sx={{ borderColor: '#22d3ee', color: '#22d3ee', height: 16, fontSize: '0.6rem' }} variant="outlined" />
                        </Box>
                        <Typography variant="h4" sx={{ color: '#fff', fontSize: '1.75rem', mb: 1 }}>
                            Projeções Econômicas
                        </Typography>
                        <Typography variant="body1" sx={{ color: '#94a3b8', maxWidth: '800px', lineHeight: 1.5, fontSize: '0.95rem' }}>
                            {ECONOMIC_DATA.narrative}
                        </Typography>
                    </div>
                    <div className="md:col-span-3 flex justify-center items-center">
                        <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                            <NadiaSphere size="small" isListening={isListening} isSpeaking={isSpeaking} isConnecting={isConnecting} audioLevel={audioLevel} />
                            <IconButton 
                                onClick={isConnected ? stopConversation : startConversation}
                                disabled={isConnecting}
                                sx={{ padding: 1, bgcolor: 'rgba(255,255,255,0.05)' }}
                            >
                                {isConnecting ? <CircularProgress size={20} sx={{ color: '#f43f5e' }} /> : <SoundWaveIcon className="w-5 h-5 text-rose-500" isListening={isListening} isSpeaking={isSpeaking} audioLevel={audioLevel} />}
                            </IconButton>
                        </Box>
                    </div>
                </div>

                {/* KPI TICKER */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                        <MiniKpi 
                            label={ECONOMIC_DATA.pib[2025].label.toUpperCase()} 
                            value={`${ECONOMIC_DATA.pib[2025].value}%`} 
                            color="#22d3ee" 
                            trend={ECONOMIC_DATA.pib[2025].context} 
                        />
                    </div>
                    <div>
                        <MiniKpi 
                            label={ECONOMIC_DATA.pib[2026].label.toUpperCase()} 
                            value={`${ECONOMIC_DATA.pib[2026].value}%`} 
                            color="#34d399" 
                            trend={ECONOMIC_DATA.pib[2026].context} 
                        />
                    </div>
                    <div>
                        <MiniKpi label="DESEMPREGO (SP)" value="5,4%" color="#34d399" trend="Mínima Histórica" subLabel="Mercado aquecido (PNADc)" />
                    </div>
                    <div>
                        <MiniKpi label="INVESTIMENTOS" value="R$ 106 bi" color="#f43f5e" trend="-35,1% vs 2024" subLabel="Queda de volume anunciado" />
                    </div>
                </div>

                {/* --- LAYOUT MACROECONÔMICO --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* ITEM 1.1: Atividade Setorial */}
                    <div>
                        <ChartCard title="Atividade Setorial" subtitle="Acumulado 12 Meses (%)" height={220} footerSource="IBGE (PMC/PMS/PIM-PF)">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={ECONOMIC_DATA.sectors.data}
                                    margin={{ top: 0, right: 30, bottom: 0, left: 0 }}
                                >
                                    <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" hide domain={[-5, 6]} />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        width={110}
                                        tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <RechartsTooltip
                                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', fontSize: '11px', padding: '4px', border: '1px solid rgba(255,255,255,0.1)' }}
                                    />
                                    <Bar dataKey="value" radius={4} barSize={24}>
                                        <LabelList
                                            dataKey="value"
                                            position="right"
                                            offset={10}
                                            formatter={(val: number) => val > 0 ? `+${val}%` : `${val}%`}
                                            style={{ fill: '#fff', fontWeight: 700, fontSize: '12px' }}
                                        />
                                        {ECONOMIC_DATA.sectors.data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </div>

                    {/* ITEM 1.2: Investimentos */}
                    <div>
                         <Paper sx={{ p: 2.5, height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                            <Box sx={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'radial-gradient(circle, rgba(244,63,94,0.1) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(20px)' }} />

                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
                                <Box>
                                    <Typography variant="h5" sx={{ fontSize: '1.1rem', mb: 0.5 }}>Investimentos Anunciados</Typography>
                                    <Typography variant="caption" color="text.secondary">Pesquisa de Investimentos (PIESP)</Typography>
                                </Box>
                                <Box textAlign="right">
                                    <Typography variant="h3" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.75rem', lineHeight: 1 }}>
                                        R$ {ECONOMIC_DATA.investments.total2025} bi
                                    </Typography>
                                     <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1} mt={0.5}>
                                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>
                                            2024: R$ {ECONOMIC_DATA.investments.total2024} bi
                                        </Typography>
                                        <Chip 
                                            label={ECONOMIC_DATA.investments.drop} 
                                            size="small" 
                                            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700, bgcolor: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)' }} 
                                        />
                                     </Box>
                                </Box>
                            </Box>
                            
                            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {ECONOMIC_DATA.investments.sectors.map((sector) => (
                                    <Box key={sector.name} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Box sx={{ 
                                            width: 40, height: 40, borderRadius: '10px', 
                                            bgcolor: `${sector.color}15`, 
                                            color: sector.color,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            border: `1px solid ${sector.color}30`
                                        }}>
                                            {getSectorIcon(sector.name, sector.color)}
                                        </Box>
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={0.5}>
                                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.9rem' }}>{sector.name}</Typography>
                                                <Box textAlign="right">
                                                     <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>R$ {sector.value} bi</Typography>
                                                </Box>
                                            </Box>
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <LinearProgress 
                                                    variant="determinate" 
                                                    value={sector.share} 
                                                    sx={{ 
                                                        flexGrow: 1,
                                                        height: 6, 
                                                        borderRadius: 3,
                                                        bgcolor: 'rgba(255,255,255,0.05)',
                                                        '& .MuiLinearProgress-bar': { bgcolor: sector.color, borderRadius: 3 } 
                                                    }} 
                                                />
                                                 <Typography variant="caption" sx={{ color: sector.color, fontWeight: 600, minWidth: 35, textAlign: 'right' }}>{sector.share}%</Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>

                            <Box mt={3} pt={2} borderTop="1px solid rgba(255,255,255,0.05)">
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em', mb: 1.5, display: 'block', textTransform: 'uppercase' }}>
                                    Principais Destinos
                                </Typography>
                                <Stack direction="row" spacing={1.5} flexWrap="wrap">
                                    {ECONOMIC_DATA.investments.topDestinations.map((dest) => (
                                        <Box 
                                            key={dest} 
                                            sx={{ 
                                                px: 1.5, py: 0.75, 
                                                borderRadius: '6px', 
                                                bgcolor: 'rgba(255,255,255,0.03)', 
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                display: 'flex', alignItems: 'center', gap: 1
                                            }}
                                        >
                                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22d3ee', boxShadow: '0 0 5px #22d3ee' }} />
                                            <Typography variant="body2" sx={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 500 }}>
                                                {dest.split(' (')[0]}
                                                <span style={{ color: '#94a3b8', marginLeft: '4px', fontSize: '0.75rem' }}>
                                                    ({dest.split(' (')[1]}
                                                </span>
                                            </Typography>
                                        </Box>
                                    ))}
                                </Stack>
                            </Box>
                        </Paper>
                    </div>

                    {/* ROW 2: MERCADO DE TRABALHO & INFLAÇÃO */}
                    
                    {/* ITEM 2.1: Mercado de Trabalho */}
                    <div>
                        <Paper sx={{ p: 2, height: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="h5">Mercado de Trabalho</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Fonte: IBGE/PNADc</Typography>
                            </Box>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-0">
                                {/* 1. Desemprego */}
                                <div className="col-span-1">
                                     <Box>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{fontSize: '0.6rem', fontWeight: 600}}>DESEMPREGO</Typography>
                                        <Typography variant="h6" color="#34d399" sx={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.2 }}>{ECONOMIC_DATA.labor.unemployment}</Typography>
                                        <Typography variant="caption" color="#cbd5e1" sx={{ fontSize: '0.6rem' }}>{ECONOMIC_DATA.labor.unemploymentTrend}</Typography>
                                     </Box>
                                </div>

                                {/* 2. Pop Ocupada */}
                                <div className="col-span-1">
                                     <Box sx={{ borderLeft: { sm: '1px solid rgba(255,255,255,0.05)' }, pl: { sm: 1.5 } }}>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{fontSize: '0.6rem', fontWeight: 600}}>POP. OCUPADA</Typography>
                                        <Typography variant="h6" color="#fff" sx={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.2 }}>{ECONOMIC_DATA.labor.occupiedPop}</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>{ECONOMIC_DATA.labor.occupiedPopTrend}</Typography>
                                     </Box>
                                </div>

                                {/* 3. Carteira Assinada */}
                                <div className="col-span-1">
                                     <Box sx={{ borderLeft: { sm: '1px solid rgba(255,255,255,0.05)' }, pl: { sm: 1.5 } }}>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{fontSize: '0.6rem', fontWeight: 600}}>CARTEIRA ASSIN.</Typography>
                                        <Typography variant="h6" color="#fff" sx={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.2 }}>{ECONOMIC_DATA.labor.formalJobs}</Typography>
                                        <Typography variant="caption" color="#22d3ee" sx={{ fontSize: '0.6rem' }}>{ECONOMIC_DATA.labor.formalJobsTrend}</Typography>
                                     </Box>
                                </div>

                                {/* 4. Informalidade */}
                                <div className="col-span-1">
                                     <Box sx={{ borderLeft: { sm: '1px solid rgba(255,255,255,0.05)' }, pl: { sm: 1.5 } }}>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{fontSize: '0.6rem', fontWeight: 600}}>INFORMALIDADE</Typography>
                                        <Typography variant="h6" color="#f43f5e" sx={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.2 }}>{ECONOMIC_DATA.labor.informality}</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>{ECONOMIC_DATA.labor.informalityTrend}</Typography>
                                     </Box>
                                </div>

                                {/* 5. Massa Renda */}
                                <div className="col-span-1">
                                     <Box mt={1}>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{fontSize: '0.6rem', fontWeight: 600}}>MASSA RENDA</Typography>
                                        <Typography variant="h6" color="#fff" sx={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.2 }}>{ECONOMIC_DATA.labor.incomeMass}</Typography>
                                        <Typography variant="caption" color="#34d399" sx={{ fontSize: '0.6rem' }}>{ECONOMIC_DATA.labor.incomeGrowth}</Typography>
                                     </Box>
                                </div>

                                {/* 6. Rendimento Médio */}
                                <div className="col-span-1">
                                     <Box sx={{ borderLeft: { sm: '1px solid rgba(255,255,255,0.05)' }, pl: { sm: 1.5 } }} mt={1}>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{fontSize: '0.6rem', fontWeight: 600}}>RENDIM. MÉDIO</Typography>
                                        <Typography variant="h6" color="#fff" sx={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.2 }}>{ECONOMIC_DATA.labor.avgIncome}</Typography>
                                        <Typography variant="caption" color="#22d3ee" sx={{ fontSize: '0.6rem' }}>{ECONOMIC_DATA.labor.avgIncomeTrend}</Typography>
                                     </Box>
                                </div>

                                 {/* 7. Participação */}
                                 <div className="col-span-1">
                                     <Box sx={{ borderLeft: { sm: '1px solid rgba(255,255,255,0.05)' }, pl: { sm: 1.5 } }} mt={1}>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{fontSize: '0.6rem', fontWeight: 600}}>PARTICIPAÇÃO</Typography>
                                        <Typography variant="h6" color="#fff" sx={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.2 }}>{ECONOMIC_DATA.labor.participation}</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>{ECONOMIC_DATA.labor.participationTrend}</Typography>
                                     </Box>
                                </div>

                                {/* 8. Subutilização */}
                                <div className="col-span-1">
                                     <Box sx={{ borderLeft: { sm: '1px solid rgba(255,255,255,0.05)' }, pl: { sm: 1.5 } }} mt={1}>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{fontSize: '0.6rem', fontWeight: 600}}>SUBUTILIZAÇÃO</Typography>
                                        <Typography variant="h6" color="#fff" sx={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.2 }}>{ECONOMIC_DATA.labor.underutilization}</Typography>
                                        <Typography variant="caption" color="#34d399" sx={{ fontSize: '0.6rem' }}>{ECONOMIC_DATA.labor.underutilizationTrend}</Typography>
                                     </Box>
                                </div>
                            </div>
                        </Paper>
                    </div>

                     {/* ITEM 2.2: Inflação */}
                     <div>
                        <Paper sx={{ p: 2, height: '180px', display: 'flex', flexDirection: 'column' }}>
                             <Box display="flex" justifyContent="space-between" alignItems="center" mb={0}>
                                <Typography variant="h5">Inflação (IPCA)</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Acumulado 12 Meses</Typography>
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 0, mt: 1 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        layout="vertical"
                                        data={ECONOMIC_DATA.inflation.data}
                                        margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                                    >
                                         <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                         <XAxis type="number" hide domain={[0, 10]} />
                                         <YAxis 
                                            dataKey="name" 
                                            type="category" 
                                            width={70} 
                                            tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
                                            tickLine={false}
                                            axisLine={false}
                                         />
                                         <RechartsTooltip
                                            cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', fontSize: '11px', padding: '4px', border: '1px solid rgba(255,255,255,0.1)' }}
                                         />
                                         <Bar dataKey="value" radius={4} barSize={20}>
                                            <LabelList
                                                dataKey="value"
                                                position="right"
                                                formatter={(val: number) => `${val}%`}
                                                style={{ fill: '#fff', fontWeight: 700, fontSize: '12px' }}
                                            />
                                             {ECONOMIC_DATA.inflation.data.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                         </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                <Box mt={1} pl={1} borderLeft="2px solid #f43f5e">
                                     <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2 }}>
                                         Maiores pressões: <span style={{ color: '#fff' }}>{ECONOMIC_DATA.inflation.sectors}</span>
                                     </Typography>
                                </Box>
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

export default ProjecaoView;
