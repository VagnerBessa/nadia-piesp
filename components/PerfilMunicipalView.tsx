
import React, { useState, useRef } from 'react';
import { 
  Box, 
  IconButton,
  ThemeProvider,
  createTheme,
  CircularProgress,
} from '@mui/material';
import { Type, FunctionDeclaration } from '@google/genai';
import { SwitchModeIcon } from './Icons';
import SoundWaveIcon from './SoundWaveIcon';
import { NadiaSphere } from './NadiaSphere';
import { useLiveConnection } from '../hooks/useLiveConnection';
import { SYSTEM_INSTRUCTION } from '../utils/prompts';
import GoogleMaps3DView, { MapHandles } from './GoogleMaps3DView';

const cryptoTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#f43f5e' }, 
    secondary: { main: '#22d3ee' }, 
  },
});

interface PerfilMunicipalViewProps {
  onNavigateHome: () => void;
}

// --- TOOL DEFINITIONS ---
const setLocationTool: FunctionDeclaration = {
  name: "set_location",
  description: "Atualiza o mapa para um local específico. Use para cidades, bairros, ruas, ou pontos de interesse quando o usuário pedir para 'ir', 'ver' ou 'mostrar'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      location_query: {
        type: Type.STRING,
        description: "O nome do local, endereço ou ponto de interesse (ex: Campinas, Avenida Paulista, Parque Ibirapuera)."
      },
    },
    required: ["location_query"]
  }
};

const zoomInTool: FunctionDeclaration = {
    name: "zoom_in",
    description: "Aumenta o zoom do mapa para ver a localização atual mais de perto. Use quando o usuário pedir para 'aproximar', 'aumentar o zoom' ou 'ver mais de perto'.",
    parameters: { type: Type.OBJECT, properties: {} }
};

const zoomOutTool: FunctionDeclaration = {
    name: "zoom_out",
    description: "Diminui o zoom do mapa para ter uma visão mais ampla. Use quando o usuário pedir para 'afastar', 'diminuir o zoom' ou 'ver de mais longe'.",
    parameters: { type: Type.OBJECT, properties: {} }
};

const PerfilMunicipalView: React.FC<PerfilMunicipalViewProps> = ({ onNavigateHome }) => {
  // Inicializa vazio para mostrar a RMSP. Só muda quando a IA definir.
  const [currentLocationQuery, setCurrentLocationQuery] = useState("");
  const mapRef = useRef<MapHandles>(null);

  const mapSystemInstruction = `
  **PROTOCOLO DE IDIOMA E IDENTIDADE: PRIORIDADE MÁXIMA**
  1.  **IDIOMA:** Fale EXCLUSIVAMENTE em Português do Brasil.
  2.  **SOTAQUE:** Use um sotaque **Brasileiro Nativo**. Fale com naturalidade.
  3.  **IDENTIDADE DO USUÁRIO:** NUNCA invente nomes. Chame de "você" se não souber.

  ${SYSTEM_INSTRUCTION}

  **MODO ATUAL: GEÓGRAFA E URBANISTA (PERFIL MUNICIPAL & MAPAS 3D)**

  **SUAS HABILIDADES:**
  1.  **Controle de Navegação:** Use \`set_location\` para mover e \`zoom_in\`/\`zoom_out\` para ajustar.

  2.  **COMPORTAMENTO PÓS-NAVEGAÇÃO (CRÍTICO):**
      - Ao chegar ao destino, **APENAS CONFIRME** brevemente.
      - Exemplo: "Chegamos em Campinas." ou "Aqui está a Avenida Paulista."
      - **PROIBIDO PERGUNTAR:** "Qual o próximo destino?", "O que quer ver agora?" ou "Posso ajudar?".
      - **REGRA DE OURO:** Faça a afirmação de chegada e fique em silêncio para o usuário apreciar a vista.

  3.  **Conhecimento Especializado (SOB DEMANDA):**
      - **Não descreva o local automaticamente.** Apenas confirme a chegada.
      - **SE** o usuário perguntar "O que é isso?" ou "Fale sobre a cidade", aí sim use seu conhecimento de geógrafa (relevo, hidrografia, urbanismo).
      - Use o Google Search para buscar dados atualizados.

  **4. PROTOCOLO DE FONTES E DADOS (ESPECÍFICO PARA ESTE MODO):**
  *   **NÃO atribua tudo ao Seade.** Como você está buscando dados na internet em tempo real, a fonte provavelmente será **IBGE**, **Censo 2022**, **Prefeitura Municipal** ou **Wikipédia**.
  *   **Cite a fonte REAL** da informação que você encontrou através da busca.
      *   Exemplo Correto: "A população é de 1 milhão de habitantes (Fonte: IBGE)."
      *   Exemplo Errado: "A população é de 1 milhão (Fonte: Seade)." (A menos que o dado realmente venha de um relatório do Seade).

  **LEMBRE-SE: Chegue ao local e encerre a fala. Não puxe assunto.**
  `;

  const handleToolCall = async (toolCall: any) => {
      switch(toolCall.name) {
        case 'set_location':
            // Robustez para aceitar variações de argumentos do modelo
            const args = toolCall.args;
            const query = args.location_query || args.location || args.address || args.city || args.query;

            if (query) {
                setCurrentLocationQuery(query);
                // Retorna instrução explícita para o modelo encerrar a fala
                return { 
                    status: "ok", 
                    message: `Mapa movido para ${query}. Instrução para IA: Confirme a chegada (ex: "Estamos em ${query}") e PARE DE FALAR. Não faça perguntas.` 
                };
            }
            return { status: "error", message: "Local não especificado no comando." };

        case 'zoom_in':
            mapRef.current?.zoomIn();
            return { status: "ok", message: `Zoom aumentado. Apenas confirme.` };
        case 'zoom_out':
            mapRef.current?.zoomOut();
            return { status: "ok", message: `Zoom diminuído. Apenas confirme.` };
      }
      return { status: "error", message: "Ferramenta não reconhecida." };
  };

  const {
    isConnected,
    isSpeaking,
    isConnecting,
    audioLevel,
    startConversation,
    stopConversation
  } = useLiveConnection({
      systemInstruction: mapSystemInstruction,
      tools: [{ functionDeclarations: [setLocationTool, zoomInTool, zoomOutTool] }, { googleSearch: {} }],
      onToolCall: handleToolCall
  });

  const isListening = isConnected && !isSpeaking;

  return (
    <ThemeProvider theme={cryptoTheme}>
      <Box sx={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden', bgcolor: '#0f172a' }}>
        
        <GoogleMaps3DView ref={mapRef} locationQuery={currentLocationQuery} />

        <Box
            sx={{
                position: 'absolute',
                top: 24,
                right: 24,
                zIndex: 30,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
            }}
        >
             <IconButton 
                onClick={onNavigateHome} 
                sx={{ 
                    color: '#fff',
                    bgcolor: 'rgba(15, 23, 42, 0.4)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(8px)',
                    '&:hover': { bgcolor: 'rgba(15, 23, 42, 0.6)' }
                }}
            >
                <SwitchModeIcon className="w-5 h-5" />
            </IconButton>

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
                            className="w-6 h-6 text-rose-600" 
                            isListening={isListening} 
                            isSpeaking={isSpeaking}
                            audioLevel={audioLevel}
                        />
                    )}
                </IconButton>
            </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default PerfilMunicipalView;
