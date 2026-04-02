
import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Paper, 
  Typography, 
  Button,
  IconButton,
  TextField,
  LinearProgress,
  Chip,
  ThemeProvider,
  createTheme,
  Stack,
  Fade
} from '@mui/material';
import { 
  SwitchModeIcon, 
  CloudArrowUpIcon, 
  DocumentIcon, 
  VideoCameraIcon, 
  MicrophoneIcon, 
  PhotoIcon 
} from './Icons';
import { NadiaSphere } from './NadiaSphere';
import { SmallNadiaSphere } from './SmallNadiaSphere';

interface UploadViewProps {
  onNavigateHome: () => void;
}

// --- Types ---
interface PublishedItem {
    id: string;
    title: string;
    type: string;
    size: string;
    date: string;
    status: 'Indexado' | 'Processando';
    author: string;
}

// --- Theme ---
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
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(15, 23, 42, 0.5)', 
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
        },
      },
    },
    MuiTextField: {
        styleOverrides: {
            root: {
                '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#f43f5e' },
                }
            }
        }
    }
  },
});

const UploadView: React.FC<UploadViewProps> = ({ onNavigateHome }) => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('relatorio');
  
  // Upload Process State
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [nadiaStatus, setNadiaStatus] = useState<string>("Aguardando arquivos para catalogação.");
  
  // Repository Data (Mock + Real Updates)
  const [publishedItems, setPublishedItems] = useState<PublishedItem[]>([
      { id: '1', title: 'Boletim Conjuntura - Dezembro 2025', type: 'relatorio', size: '2.4 MB', date: 'Hoje, 09:30', status: 'Indexado', author: 'Gerência Econ.' },
      { id: '2', title: 'Webinar: Análise do PIB Trimestral', type: 'video', size: '450 MB', date: 'Ontem', status: 'Indexado', author: 'Comunicação' },
      { id: '3', title: 'SeadeCast #42: Inovação no Setor Público', type: 'podcast', size: '45 MB', date: '04/12/2025', status: 'Indexado', author: 'Estúdio Seade' },
  ]);

  const inputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (newFiles: File[]) => {
    setFiles(newFiles);
    // Auto-fill title if empty
    if (!title) {
        setTitle(newFiles[0].name.split('.')[0]);
    }
    setNadiaStatus(`Arquivo "${newFiles[0].name}" detectado. Validei o formato e parece seguro. Preencha os detalhes para publicar.`);
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const startUpload = () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setNadiaStatus("Iniciando upload criptografado para o Data Lake do Seade...");
    
    // Simulate Upload Process
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2; // Faster simulation
      setUploadProgress(progress);

      // Nadia updates based on progress
      if (progress === 30) setNadiaStatus("Enviando pacotes de dados...");
      if (progress === 60) setNadiaStatus("Gerando metadados e tags automáticas...");
      if (progress === 80) setNadiaStatus("Finalizando indexação na base de conhecimento...");

      if (progress >= 100) {
        clearInterval(interval);
        completeUpload();
      }
    }, 50);
  };

  const completeUpload = () => {
    setIsUploading(false);
    setUploadProgress(0);
    setNadiaStatus("Sucesso! O conteúdo foi publicado e já está disponível para consulta no repositório abaixo.");

    // Create new item
    const newItem: PublishedItem = {
        id: Date.now().toString(),
        title: title || files[0].name,
        type: category,
        size: `${(files[0].size / 1024 / 1024).toFixed(2)} MB`,
        date: 'Agora',
        status: 'Indexado',
        author: 'Você' // In a real app, user's name
    };

    // Add to list (animation happens automatically via React)
    setPublishedItems(prev => [newItem, ...prev]);

    // Reset Form
    setFiles([]);
    setTitle('');
    setDescription('');
    setTags('');
    
    // Reset Nadia after a delay
    setTimeout(() => {
        setNadiaStatus("Pronta para a próxima catalogação.");
    }, 5000);
  };

  const getIconForCategory = (cat: string) => {
      switch(cat) {
          case 'video': return <VideoCameraIcon className="w-5 h-5" />;
          case 'podcast': return <MicrophoneIcon className="w-5 h-5" />;
          case 'infografico': return <PhotoIcon className="w-5 h-5" />;
          default: return <DocumentIcon className="w-5 h-5" />;
      }
  };

  const getLabelForCategory = (cat: string) => {
    switch(cat) {
        case 'video': return 'Vídeo';
        case 'podcast': return 'Áudio';
        case 'infografico': return 'Imagem';
        default: return 'Documento';
    }
  };

  return (
    <ThemeProvider theme={cryptoTheme}>
      <Box sx={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
        
        {/* Background Overlay */}
        <Box sx={{ 
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, 
            background: 'radial-gradient(ellipse at 80% 0%, rgba(244, 63, 94, 0.1), transparent 70%)',
            pointerEvents: 'none'
        }} />

        <IconButton 
            onClick={onNavigateHome} 
            sx={{ position: 'absolute', top: 12, right: 24, zIndex: 20, bgcolor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
        >
            <SwitchModeIcon className="w-5 h-5" />
        </IconButton>

        <Box sx={{ height: '100%', overflowY: 'auto', pb: 2, position: 'relative', zIndex: 1 }} className="custom-scrollbar">
            <Container maxWidth="lg" sx={{ pt: 4, pb: 8 }}>
                
                {/* Header */}
                <Box mb={4}>
                     <Typography variant="overline" sx={{ color: '#f43f5e', letterSpacing: '0.1em' }}>ÁREA TÉCNICA</Typography>
                     <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700 }}>Central de Publicação Multimídia</Typography>
                     <Typography variant="body1" sx={{ color: '#94a3b8', mt: 1, maxWidth: '600px' }}>
                        Alimente a base de conhecimento da Fundação Seade. Os arquivos enviados aqui tornam-se imediatamente acessíveis para análise.
                     </Typography>
                </Box>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    
                    {/* Left Column: Upload Form */}
                    <div className="md:col-span-8">
                        <Paper sx={{ p: 4, position: 'relative', overflow: 'hidden' }}>
                            {/* Category Selector */}
                            <Box mb={3}>
                                <Typography variant="subtitle2" color="text.secondary" mb={1} sx={{fontSize: '0.75rem', fontWeight: 600}}>SELECIONE O TIPO</Typography>
                                <Box display="flex" gap={1} flexWrap="wrap">
                                    {[
                                        { id: 'relatorio', label: 'Relatório PDF', icon: <DocumentIcon className="w-4 h-4"/> },
                                        { id: 'video', label: 'Vídeo/Webinar', icon: <VideoCameraIcon className="w-4 h-4"/> },
                                        { id: 'podcast', label: 'Podcast', icon: <MicrophoneIcon className="w-4 h-4"/> },
                                        { id: 'infografico', label: 'Infográfico', icon: <PhotoIcon className="w-4 h-4"/> }
                                    ].map((type) => (
                                        <Chip 
                                            key={type.id}
                                            icon={type.icon}
                                            label={type.label}
                                            onClick={() => setCategory(type.id)}
                                            variant={category === type.id ? 'filled' : 'outlined'}
                                            sx={{ 
                                                bgcolor: category === type.id ? 'rgba(244, 63, 94, 0.15)' : 'transparent',
                                                borderColor: category === type.id ? '#f43f5e' : 'rgba(255,255,255,0.2)',
                                                color: category === type.id ? '#f43f5e' : '#cbd5e1',
                                                '&:hover': { bgcolor: 'rgba(244, 63, 94, 0.25)' },
                                                cursor: 'pointer'
                                            }}
                                        />
                                    ))}
                                </Box>
                            </Box>

                            {/* Drop Zone */}
                            {!files.length ? (
                                <Box 
                                    onDragEnter={handleDrag} 
                                    onDragLeave={handleDrag} 
                                    onDragOver={handleDrag} 
                                    onDrop={handleDrop}
                                    onClick={onButtonClick}
                                    sx={{
                                        border: `2px dashed ${dragActive ? '#f43f5e' : 'rgba(255,255,255,0.1)'}`,
                                        borderRadius: '12px',
                                        bgcolor: dragActive ? 'rgba(244, 63, 94, 0.05)' : 'rgba(0,0,0,0.2)',
                                        p: 6,
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 2,
                                        mb: 3,
                                        '&:hover': {
                                            borderColor: 'rgba(255,255,255,0.3)',
                                            bgcolor: 'rgba(0,0,0,0.3)'
                                        }
                                    }}
                                >
                                    <input 
                                        ref={inputRef} 
                                        type="file" 
                                        multiple={false} 
                                        onChange={handleChange} 
                                        style={{ display: 'none' }} 
                                    />
                                    <CloudArrowUpIcon className="w-12 h-12 text-slate-500" />
                                    <Box>
                                        <Typography variant="body1" color="text.primary" fontWeight={500}>
                                            Clique para selecionar ou arraste o arquivo
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.7 }}>
                                            PDF, MP4, MP3, PNG (Máx 500MB)
                                        </Typography>
                                    </Box>
                                </Box>
                            ) : (
                                <Box 
                                    sx={{
                                        border: '1px solid rgba(34, 211, 238, 0.3)',
                                        borderRadius: '12px',
                                        bgcolor: 'rgba(34, 211, 238, 0.05)',
                                        p: 3,
                                        mb: 3,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <Box display="flex" alignItems="center" gap={2}>
                                        <Box sx={{ 
                                            w: 10, h: 10, borderRadius: '50%', 
                                            bgcolor: 'rgba(34, 211, 238, 0.2)', 
                                            color: '#22d3ee',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            p: 1.5
                                        }}>
                                            {getIconForCategory(category)}
                                        </Box>
                                        <Box>
                                            <Typography variant="body2" color="#fff" fontWeight={600}>{files[0].name}</Typography>
                                            <Typography variant="caption" color="text.secondary">{(files[0].size / 1024 / 1024).toFixed(2)} MB • Pronto para envio</Typography>
                                        </Box>
                                    </Box>
                                    <Button 
                                        size="small" 
                                        color="error" 
                                        onClick={(e) => { e.stopPropagation(); setFiles([]); setTitle(''); }}
                                        disabled={isUploading}
                                    >
                                        Remover
                                    </Button>
                                </Box>
                            )}

                            {/* Metadata Form */}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <TextField 
                                        fullWidth 
                                        label="Título da Publicação" 
                                        variant="outlined" 
                                        size="small" 
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        InputLabelProps={{style: {color: '#94a3b8'}}} 
                                        InputProps={{style: {color: 'white'}}} 
                                    />
                                </div>
                                <div>
                                    <TextField 
                                        fullWidth 
                                        multiline 
                                        rows={3} 
                                        label="Descrição / Resumo Executivo" 
                                        variant="outlined" 
                                        size="small" 
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        InputLabelProps={{style: {color: '#94a3b8'}}} 
                                        InputProps={{style: {color: 'white'}}} 
                                    />
                                </div>
                                <div>
                                    <TextField 
                                        fullWidth 
                                        label="Tags (separadas por vírgula)" 
                                        placeholder="Ex: Economia, PIB, Indústria" 
                                        variant="outlined" 
                                        size="small" 
                                        value={tags}
                                        onChange={(e) => setTags(e.target.value)}
                                        InputLabelProps={{style: {color: '#94a3b8'}}} 
                                        InputProps={{style: {color: 'white'}}} 
                                    />
                                </div>
                            </div>

                            {/* Progress & Action */}
                            <Box mt={4}>
                                {isUploading && (
                                    <Box mb={2}>
                                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                                            <Typography variant="caption" color="#22d3ee">Processando Envio...</Typography>
                                            <Typography variant="caption" color="white">{Math.round(uploadProgress)}%</Typography>
                                        </Box>
                                        <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { bgcolor: '#22d3ee' }, bgcolor: 'rgba(255,255,255,0.1)' }} />
                                    </Box>
                                )}

                                <Button 
                                    fullWidth 
                                    variant="contained" 
                                    disabled={files.length === 0 || !title || isUploading}
                                    onClick={startUpload}
                                    sx={{ 
                                        bgcolor: '#f43f5e', 
                                        color: 'white', 
                                        py: 1.5,
                                        fontWeight: 600,
                                        '&:hover': { bgcolor: '#e11d48' },
                                        '&:disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: '#64748b' }
                                    }}
                                >
                                    {isUploading ? 'PUBLICANDO...' : 'PUBLICAR CONTEÚDO'}
                                </Button>
                            </Box>

                        </Paper>
                    </div>

                    {/* Right Column: Nadia Assistant */}
                    <div className="md:col-span-4">
                        <Paper sx={{ p: 3, height: '100%', position: 'relative', overflow: 'hidden' }}>
                             <Box display="flex" alignItems="center" gap={2} mb={3}>
                                <NadiaSphere 
                                    size="small" 
                                    isListening={false} 
                                    isSpeaking={isUploading} 
                                    isConnecting={false} 
                                    audioLevel={isUploading ? 0.5 : 0} 
                                />
                                <Box>
                                    <Typography variant="h6" color="white">Assistente Nadia</Typography>
                                    <Typography variant="caption" color="#22d3ee">Catalogação Inteligente</Typography>
                                </Box>
                             </Box>

                             <Box 
                                sx={{ 
                                    bgcolor: 'rgba(0,0,0,0.3)', 
                                    borderRadius: '12px', 
                                    p: 2, 
                                    minHeight: '120px',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    mb: 3
                                }}
                             >
                                 <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', lineHeight: 1.6 }}>
                                    "{nadiaStatus}"
                                 </Typography>
                             </Box>

                            <Box>
                                <Typography variant="overline" color="text.secondary" display="block" mb={1}>ESTATÍSTICAS DE ENVIO</Typography>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Box p={1.5} borderRadius={2} bgcolor="rgba(255,255,255,0.03)">
                                            <Typography variant="caption" color="text.secondary">Total Hoje</Typography>
                                            <Typography variant="h6" color="white">12</Typography>
                                        </Box>
                                    </div>
                                    <div>
                                        <Box p={1.5} borderRadius={2} bgcolor="rgba(255,255,255,0.03)">
                                            <Typography variant="caption" color="text.secondary">Armazenamento</Typography>
                                            <Typography variant="h6" color="white">45%</Typography>
                                        </Box>
                                    </div>
                                </div>
                            </Box>
                        </Paper>
                    </div>

                </div>

                {/* --- NEW SECTION: REPOSITORY / LIBRARY --- */}
                <Box mt={6}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} borderBottom="1px solid rgba(255,255,255,0.1)" pb={2}>
                        <Box>
                            <Typography variant="h5" color="white" fontWeight={700}>Repositório de Conteúdos</Typography>
                            <Typography variant="caption" color="text.secondary">Itens publicados e disponíveis para a IA consultar</Typography>
                        </Box>
                        <Chip label={`${publishedItems.length} Itens`} size="small" variant="outlined" sx={{ color: '#94a3b8', borderColor: '#475569' }} />
                    </Box>

                    {/* Repository List */}
                    <Stack spacing={2}>
                        {publishedItems.map((item, index) => (
                            <Fade in={true} timeout={500 + (index * 100)} key={item.id}>
                                <Paper 
                                    elevation={0}
                                    sx={{ 
                                        p: 2, 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        gap: 2,
                                        bgcolor: 'rgba(30, 41, 59, 0.4)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            bgcolor: 'rgba(30, 41, 59, 0.7)',
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            transform: 'translateY(-2px)'
                                        }
                                    }}
                                >
                                    <Box display="flex" alignItems="center" gap={3}>
                                        {/* Icon Box */}
                                        <Box 
                                            sx={{ 
                                                width: 48, height: 48, borderRadius: '8px',
                                                bgcolor: 'rgba(255,255,255,0.03)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#cbd5e1'
                                            }}
                                        >
                                            {getIconForCategory(item.type)}
                                        </Box>
                                        
                                        {/* Content Info */}
                                        <Box>
                                            <Typography variant="body1" color="white" fontWeight={600}>{item.title}</Typography>
                                            <Box display="flex" alignItems="center" gap={1.5} mt={0.5}>
                                                <Typography variant="caption" color="#94a3b8" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    {getLabelForCategory(item.type)} • {item.size}
                                                </Typography>
                                                <Box width="3px" height="3px" borderRadius="50%" bgcolor="#475569" />
                                                <Typography variant="caption" color="#64748b">
                                                    Enviado por {item.author} • {item.date}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>

                                    {/* Status Badge */}
                                    <Chip 
                                        label={item.status} 
                                        size="small" 
                                        sx={{ 
                                            bgcolor: item.status === 'Indexado' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(251, 191, 36, 0.1)', 
                                            color: item.status === 'Indexado' ? '#34d399' : '#fbbf24',
                                            fontWeight: 600,
                                            height: 24
                                        }} 
                                    />
                                </Paper>
                            </Fade>
                        ))}
                    </Stack>
                </Box>

            </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default UploadView;
