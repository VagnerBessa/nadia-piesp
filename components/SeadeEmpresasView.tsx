
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
  LinearProgress
} from '@mui/material';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell,
  RadialBarChart,
  RadialBar,
  PolarGrid,
  PolarRadiusAxis,
  Label
} from 'recharts';
import { SwitchModeIcon } from './Icons';
import SoundWaveIcon from './SoundWaveIcon';
import { NadiaSphere } from './NadiaSphere';
import { useLiveConnection } from '../hooks/useLiveConnection';
import { SYSTEM_INSTRUCTION } from '../utils/prompts';

// --- Data Constants ---
const EMPRESAS_DATA_CONTEXT = {
  referenceMonth: "Julho 2025",
  publicationDate: "Novembro 2025",
  summary: {
    totalBusiness: "129.717", // Empresas + MEIs
    totalBusinessGrowth: "+13,8%"
  },
  empresas: {
    total: "37.479",
    growth: 9.1, // Number for chart
    growthStr: "+9,1%",
    accumulated12m: "523.946"
  },
  meis: {
    total: "92.238",
    growth: 15.8, // Number for chart
    growthStr: "+15,8%",
    accumulated12m: "878.893"
  },
  // Combined data for the main comparison chart
  chartDataComparison: [
     { month: 'Ago 24', empresas: 50401, meis: 61585 }, 
     { month: 'Set', empresas: 48891, meis: 60457 }, 
     { month: 'Out', empresas: 51707, meis: 65593 }, 
     { month: 'Nov', empresas: 43189, meis: 54878 }, 
     { month: 'Dez', empresas: 36216, meis: 40142 }, 
     { month: 'Jan 25', empresas: 51525, meis: 108158 }, // MEI spike typical in Jan
     { month: 'Fev', empresas: 47920, meis: 78646 }, 
     { month: 'Mar', empresas: 43256, meis: 77213 }, 
     { month: 'Abr', empresas: 39789, meis: 77193 }, 
     { month: 'Mai', empresas: 39220, meis: 83128 }, 
     { month: 'Jun', empresas: 34353, meis: 79662 }, 
     { month: 'Jul 25', empresas: 37479, meis: 92238 }
  ],
  // Data for Sector Cards (EMPRESAS - Page 2)
  empresasSectors: [
    { name: 'Serviços', value: "366k", share: 69.9, color: '#818cf8', icon: 'M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m0-16.875l-2.25 1.313M3 14.25v2.25l2.25 1.313' },
    { name: 'Comércio', value: "106k", share: 20.3, color: '#22d3ee', icon: 'M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z' },
    { name: 'Indústria', value: "23k", share: 4.5, color: '#34d399', icon: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z' },
    { name: 'Constr.', value: "60k", share: 6.9, color: '#fbbf24', icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21' },
  ],
  // Data for Sector Cards (MEI)
  meiSectors: [
    { name: 'Serviços', value: "579k", share: 66.0, color: '#f43f5e', icon: 'M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m0-16.875l-2.25 1.313M3 14.25v2.25l2.25 1.313' },
    { name: 'Comércio', value: "193k", share: 22.0, color: '#f97316', icon: 'M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z' },
    { name: 'Indústria', value: "61k", share: 7.0, color: '#10b981', icon: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z' },
    { name: 'Constr.', value: "45k", share: 5.0, color: '#eab308', icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21' },
  ],
  // Ranking Data
  rankingRegions: [
    { rank: 1, name: 'RMSP', value: 311904, share: 60 },
    { rank: 2, name: 'Campinas', value: 69233, share: 13 },
    { rank: 3, name: 'Sorocaba', value: 23526, share: 4.5 },
    { rank: 4, name: 'S.J.Campos', value: 23397, share: 4.5 },
    { rank: 5, name: 'Santos', value: 16235, share: 3.1 },
    { rank: 6, name: 'Rib. Preto', value: 14754, share: 2.8 },
  ]
};

// --- Futuristic Dark Crypto Theme (Compact) ---
const cryptoTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: 'transparent',
      paper: 'rgba(2, 6, 23, 0.4)', 
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
    },
    primary: { main: '#f43f5e' }, // MEI Color (Rose)
    secondary: { main: '#22d3ee' }, // Empresas Color (Cyan)
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h3: { fontWeight: 600, letterSpacing: '-0.02em', fontSize: '1.25rem' }, // More Compact
    h4: { fontWeight: 600, letterSpacing: '-0.02em', fontSize: '1.1rem' }, // More Compact
    h5: { fontWeight: 500, letterSpacing: '-0.01em', fontSize: '0.9rem' },
    h6: { fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.02em' },
    overline: { fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.6rem', color: '#64748b' },
    body1: { fontSize: '0.85rem' },
    body2: { fontSize: '0.75rem' },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(15, 23, 42, 0.5)', 
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease',
        },
      },
    },
    MuiLinearProgress: {
        styleOverrides: {
            root: {
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.1)'
            }
        }
    }
  },
});

interface SeadeEmpresasViewProps {
  onNavigateHome: () => void;
}

// Ultra Compact Sector Card
const SectorCard = ({ data }: { data: any }) => (
    <Paper elevation={0} sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1.5, height: '64px' }}>
        <Box 
            sx={{ 
                p: 0.8, 
                borderRadius: '8px', 
                bgcolor: `${data.color}20`, 
                color: data.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 32,
                height: 32
            }}
        >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d={data.icon} />
            </svg>
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box display="flex" justifyContent="space-between" alignItems="baseline">
                <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.75rem' }}>{data.name}</Typography>
                <Typography variant="caption" sx={{ color: data.color, fontWeight: 700 }}>{data.share}%</Typography>
            </Box>
             <LinearProgress 
                variant="determinate" 
                value={data.share} 
                sx={{ 
                    my: 0.5, 
                    height: 3, 
                    '& .MuiLinearProgress-bar': { backgroundColor: data.color } 
                }} 
            />
             <Typography variant="caption" color="text.secondary" sx={{fontSize: '0.65rem'}}>{data.value} aberturas</Typography>
        </Box>
    </Paper>
);

// Horizontal Compact Radial Card - Optimized to be a functional gauge
const CompactRadialCard = ({ 
    title, 
    value, 
    growthLabel, 
    color, 
    total 
}: { 
    title: string, 
    value: number, 
    growthLabel: string, 
    color: string, 
    total: string 
}) => {
    // The visual arc length now represents intensity relative to a reasonable max (e.g., 20% growth is a full circle)
    // We clamp it so it doesn't break the chart if growth is huge
    const maxReference = 25; 
    const percentageFill = Math.min(value, maxReference) / maxReference;
    // RadialBarChart uses angles: 90 is top. 
    // We want to draw an arc. Let's say a full circle is 360.
    // If we want it to look like a gauge:
    const endAngle = 90 - (percentageFill * 360); 

    const data = [{ name: 'growth', value: value, fill: color }];

    return (
        <Paper elevation={0} sx={{ 
            p: 1.5, 
            height: '90px', 
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Left: The Visual Arc Gauge */}
            <Box sx={{ width: 70, height: 70, position: 'relative', flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart 
                        cx="50%" 
                        cy="50%" 
                        innerRadius="70%" 
                        outerRadius="100%" 
                        barSize={5} 
                        data={data} 
                        startAngle={90} 
                        endAngle={endAngle}
                    >
                         <PolarGrid 
                            gridType="circle" 
                            radialLines={false} 
                            stroke="rgba(255,255,255,0.05)"
                            polarRadius={[30, 40]}
                        />
                        <RadialBar
                            background={{ fill: 'rgba(255,255,255,0.05)' }}
                            dataKey="value"
                            cornerRadius={10}
                        />
                    </RadialBarChart>
                </ResponsiveContainer>
                {/* Centered Percentage inside the arc */}
                <Box sx={{ 
                    position: 'absolute', 
                    top: 0, left: 0, right: 0, bottom: 0, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column'
                }}>
                    <Typography variant="caption" sx={{ color: color, fontWeight: 800, fontSize: '0.8rem', lineHeight: 1 }}>
                        {value}%
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.5rem', textTransform: 'uppercase' }}>
                        Cresc.
                    </Typography>
                </Box>
            </Box>

            {/* Right: Data Context */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 8px ${color}` }} />
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.05em' }}>
                        {title}
                    </Typography>
                </Box>
                
                <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, fontSize: '1.5rem' }}>
                    {total}
                </Typography>
                
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.65rem', mt: 0.5 }}>
                    vs. mês anterior ({growthLabel})
                </Typography>
            </Box>
        </Paper>
    );
};

const SeadeEmpresasView: React.FC<SeadeEmpresasViewProps> = ({ onNavigateHome }) => {
  const empresasSystemInstruction = `
  ${SYSTEM_INSTRUCTION}

  **SITUAÇÃO ATUAL: MODO EXPERT EM EMPREENDEDORISMO (MONITOR SEADE)**

  Você agora é a **Especialista Sênior em Empreendedorismo da Fundação Seade**.
  Sua autoridade vai além dos números: você domina a legislação (Lei Geral das MPEs), a dinâmica do MEI e a metodologia do Seade.

  **SEUS PILARES DE CONHECIMENTO (Use para enriquecer as respostas):**
  1.  **Legislação e Tributação:**
      - Sabe que o MEI (Lei Complementar nº 128/2008) é a porta de entrada da formalização com limite de faturamento de R$ 81 mil/ano.
      - Entende o Simples Nacional e seus benefícios para MPEs (Micro e Pequenas Empresas).
  2.  **Dinâmica Econômica:**
      - Sabe diferenciar "Empreendedorismo de Oportunidade" vs. "Necessidade" (metodologia Seade/GEM).
      - Entende que o crescimento de MEIs em Serviços (66% do total) reflete a "terciarização" da economia e a flexibilização das relações de trabalho (fenômeno da "Pejotização").
  3.  **Contexto Regional:**
      - Sabe que a RMSP concentra 60% das aberturas porque é o centro financeiro e de serviços do país, atraindo startups e autônomos.

  **DIRETRIZES DE RESPOSTA:**
  - **Não leia apenas o gráfico.** Se o usuário perguntar "Por que MEI cresceu tanto?", explique: "Além da facilidade de formalização e baixo custo tributário (DAS), o setor de Serviços, que exige menos capital físico, impulsiona esse número em SP."
  - **Use a terminologia correta:** "Natureza Jurídica", "CNAE" (Classificação Nacional de Atividades Econômicas), "Capital Social".

  **CONTEXTO DE DADOS VISÍVEIS (Use estes números exatos):**
  ${JSON.stringify(EMPRESAS_DATA_CONTEXT, null, 2)}
  `;

  const {
    isConnected,
    isSpeaking,
    isConnecting,
    audioLevel,
    startConversation,
    stopConversation
  } = useLiveConnection({ systemInstruction: empresasSystemInstruction });

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
            background: 'radial-gradient(circle at 20% 80%, rgba(244, 63, 94, 0.08), transparent 40%)',
            pointerEvents: 'none'
        }} />

        {/* Back Button */}
         <IconButton 
            onClick={onNavigateHome} 
            sx={{ 
                position: 'absolute',
                top: 12,
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

        {/* Scrollable Content */}
        <Box sx={{ height: '100%', overflowY: 'auto', pb: 2, position: 'relative', zIndex: 1 }} className="custom-scrollbar">
            <Container maxWidth="xl" sx={{ pt: 1.5, pb: 4 }}>
                
                {/* Header Grid - Compacted */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-3 items-center">
                    <div className="md:col-span-9">
                        <Box display="flex" alignItems="center" gap={2} mb={0.5}>
                             <Typography variant="overline" sx={{ color: '#f43f5e', textShadow: '0 0 10px rgba(244,63,94,0.5)', fontWeight: 800 }}>
                                MONITOR DE EMPREENDEDORISMO
                            </Typography>
                            <Chip 
                                label={EMPRESAS_DATA_CONTEXT.referenceMonth.toUpperCase()} 
                                size="small" 
                                sx={{ 
                                    borderColor: '#f43f5e', 
                                    color: '#f43f5e',
                                    fontWeight: 700,
                                    height: 18,
                                    fontSize: '0.65rem'
                                }} 
                                variant="outlined" 
                            />
                        </Box>
                        <Box display="flex" alignItems="baseline" gap={2} flexWrap="wrap">
                            <Typography variant="h4" component="h1" sx={{ color: '#fff', letterSpacing: '-0.02em', fontWeight: 700 }}>
                                Abertura de Empresas
                            </Typography>
                             <Typography variant="body1" sx={{ fontSize: '1rem', color: '#cbd5e1', fontWeight: 300 }}>
                                 SP registra <span style={{ color: '#f43f5e', fontWeight: 600 }}>{EMPRESAS_DATA_CONTEXT.summary.totalBusiness}</span> novos negócios.
                            </Typography>
                        </Box>
                    </div>

                    {/* Nadia Widget Section - STACKED COLUMN (ICON BELOW SPHERE) */}
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

                {/* Hero Stats - Horizontal Layout, NO Container, Directly in Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <CompactRadialCard 
                            title="EMPRESAS (LTDA/SA)"
                            total={EMPRESAS_DATA_CONTEXT.empresas.total}
                            value={EMPRESAS_DATA_CONTEXT.empresas.growth}
                            growthLabel={EMPRESAS_DATA_CONTEXT.empresas.growthStr}
                            color="#22d3ee" // Cyan
                        />
                    </div>
                    <div>
                        <CompactRadialCard 
                            title="MICROEMPREENDEDOR (MEI)"
                            total={EMPRESAS_DATA_CONTEXT.meis.total}
                            value={EMPRESAS_DATA_CONTEXT.meis.growth}
                            growthLabel={EMPRESAS_DATA_CONTEXT.meis.growthStr}
                            color="#f43f5e" // Rose
                        />
                    </div>
                </div>

                {/* Main Content Grid: Charts - Height Reduced significantly (190px) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                    {/* Evolution Chart */}
                    <div className="md:col-span-8">
                        <Paper sx={{ p: 2, height: '190px', display: 'flex', flexDirection: 'column' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                                <Typography variant="h6">Evolução Mensal</Typography>
                                <Box display="flex" gap={2}>
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        <Box sx={{ w: 6, h: 6, borderRadius: '50%', bgcolor: '#f43f5e' }} />
                                        <Typography variant="caption" sx={{fontSize: '0.7rem'}}>MEI</Typography>
                                    </Box>
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        <Box sx={{ w: 6, h: 6, borderRadius: '50%', bgcolor: '#22d3ee' }} />
                                        <Typography variant="caption" sx={{fontSize: '0.7rem'}}>Empresas</Typography>
                                    </Box>
                                </Box>
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={EMPRESAS_DATA_CONTEXT.chartDataComparison} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorMei" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorEmp" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="month" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} dy={5} minTickGap={20} />
                                        <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                                        <RechartsTooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px', padding: '4px' }}
                                        />
                                        <Area type="monotone" dataKey="meis" stroke="#f43f5e" fillOpacity={1} fill="url(#colorMei)" strokeWidth={2} />
                                        <Area type="monotone" dataKey="empresas" stroke="#22d3ee" fillOpacity={1} fill="url(#colorEmp)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>
                    </div>

                    {/* Regional Ranking - Compacted */}
                    <div className="md:col-span-4">
                         <Paper sx={{ p: 2, height: '190px', display: 'flex', flexDirection: 'column' }}>
                             <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                                <Typography variant="h6">Ranking Regional</Typography>
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={EMPRESAS_DATA_CONTEXT.rankingRegions} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={70} />
                                        <RechartsTooltip 
                                             cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                             contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px', padding: '4px' }}
                                        />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                                            {EMPRESAS_DATA_CONTEXT.rankingRegions.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#f43f5e' : '#334155'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                         </Paper>
                    </div>
                </div>

                {/* EMPRESAS SECTORS - Dense Grid */}
                <Typography variant="overline" color="secondary" sx={{ mb: 0.5, display: 'block' }}>PERFIL: EMPRESAS</Typography>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {EMPRESAS_DATA_CONTEXT.empresasSectors.map((sector, idx) => (
                        <div key={idx}>
                            <SectorCard data={sector} />
                        </div>
                    ))}
                </div>

                 {/* MEI SECTORS - Dense Grid */}
                 <Typography variant="overline" color="primary" sx={{ mb: 0.5, display: 'block' }}>PERFIL: MEI</Typography>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {EMPRESAS_DATA_CONTEXT.meiSectors.map((sector, idx) => (
                        <div key={idx}>
                            <SectorCard data={sector} />
                        </div>
                    ))}
                </div>

            </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default SeadeEmpresasView;
