import React from 'react';

export type PetState = 'idle' | 'attention' | 'listening' | 'speaking' | 'typing';

interface CapivaraPetProps {
  state?: PetState;
  size?: number;
  audioLevel?: number; // 0–1, RMS do áudio de saída da Nadia
}

// Cores do pixel art
const R  = '#e03848';
const Rd = '#b82030';
const P  = '#f07878';
const W  = '#f4f4f4';
const N  = '#1a1f30';
const M  = '#7a1020';

// Fone de ouvido — cores claras para contraste no fundo dark
const HP  = '#b0bcd8'; // shell externo (cinza-azul claro)
const HPm = '#7888b8'; // superfície do cup (azul médio)
const HPi = '#5060a0'; // anel interno (azul)
const HPc = '#303868'; // almofada (azul escuro visível)

const CapivaraPet: React.FC<CapivaraPetProps> = ({ state = 'idle', size = 64, audioLevel = 0 }) => {
  const isListening  = state === 'listening';
  const isSpeaking   = state === 'speaking';
  const isAttention  = state === 'attention';
  const isTyping     = state === 'typing';
  const isVoiceMode  = isListening || isSpeaking;

  const pupilDX = isSpeaking ? 5 : 0;
  const pupilDY = isAttention ? -3 : isSpeaking ? -2 : isTyping ? 3 : 0;

  let wrapperAnim: string;
  if (isAttention)      wrapperAnim = 'capivara-look-up 1.2s ease-in-out infinite';
  else if (isListening) wrapperAnim = 'capivara-breathe 3.5s ease-in-out infinite';
  else if (isSpeaking)  wrapperAnim = 'capivara-breathe 3.5s ease-in-out infinite';
  else if (isTyping)    wrapperAnim = 'capivara-breathe 2s ease-in-out infinite';
  else                  wrapperAnim = 'capivara-breathe 3.5s ease-in-out infinite, capivara-tilt 6s ease-in-out 1s infinite';

  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
    transformOrigin: 'center 90%',
    imageRendering: 'pixelated',
    animation: wrapperAnim,
  };

  const blinkAnim     = isAttention ? 'capivara-blink-slow' : 'capivara-blink';
  const blinkDuration = isAttention ? '8s' : '4.5s';
  const eyeDartStyle  = state === 'idle'
    ? { animation: 'capivara-eye-dart 5s ease-in-out 1s infinite' }
    : undefined;

  // Pulso das orelhas do fone com o áudio de saída da Nadia
  const earScale = isSpeaking ? 1 + Math.min(audioLevel * 0.6, 0.45) : 1;
  const leftCupStyle: React.CSSProperties  = {
    transform: `scale(${earScale})`,
    transformOrigin: '-8px 22px',
  };
  const rightCupStyle: React.CSSProperties = {
    transform: `scale(${earScale})`,
    transformOrigin: '104px 22px',
  };
  // Quando usuário fala: orelhas oscilam levemente (ouvindo)
  const cupListenAnim: React.CSSProperties = isListening
    ? { animation: 'capivara-ear-hear 1.1s ease-in-out infinite' }
    : {};

  return (
    <div style={wrapperStyle}>
      <svg
        viewBox="0 0 96 128"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', imageRendering: 'pixelated', overflow: 'visible' }}
      >
        {/* ── ORELHAS ───────────────────────────────── */}
        <rect x={10} y={0}  width={20} height={20} fill={Rd} />
        <rect x={14} y={4}  width={12} height={14} fill={R}  />
        <rect x={66} y={0}  width={20} height={20} fill={Rd} />
        <rect x={70} y={4}  width={12} height={14} fill={R}  />

        {/* ── CABEÇA ────────────────────────────────── */}
        <rect x={0}  y={10} width={8}  height={70} fill={Rd} />
        <rect x={4}  y={8}  width={88} height={72} fill={R}  />
        <rect x={88} y={10} width={8}  height={70} fill={Rd} />

        {/* ── OLHOS ─────────────────────────────────── */}
        <rect x={12} y={26} width={22} height={22} fill={W} />
        <rect x={62} y={26} width={22} height={22} fill={W} />
        <g style={eyeDartStyle}>
          <rect x={18 + pupilDX} y={30 + pupilDY} width={12} height={14} fill={N} />
          <rect x={66 + pupilDX} y={30 + pupilDY} width={12} height={14} fill={N} />
        </g>
        <rect x={12} y={26} width={22} height={22} fill={R}
          style={{ opacity: 0, animation: `${blinkAnim} ${blinkDuration} ease-in-out 0.3s infinite` }} />
        <rect x={62} y={26} width={22} height={22} fill={R}
          style={{ opacity: 0, animation: `${blinkAnim} ${blinkDuration} ease-in-out 0.42s infinite` }} />

        {/* ── FOCINHO ───────────────────────────────── */}
        <rect x={8}  y={52} width={80} height={26} fill={P} />
        <rect x={20} y={57} width={14} height={16} fill={M} />
        <rect x={62} y={57} width={14} height={16} fill={M} />

        {/* ── CORPO ─────────────────────────────────── */}
        <rect x={0}  y={76} width={8}  height={22} fill={Rd} />
        <rect x={4}  y={76} width={88} height={22} fill={R}  />
        <rect x={88} y={76} width={8}  height={22} fill={Rd} />

        {/* ── PERNAS ────────────────────────────────── */}
        {!isTyping && (
          <>
            <rect x={0}  y={88} width={8}  height={24} fill={Rd} />
            <rect x={4}  y={88} width={18} height={24} fill={R}  />
            <rect x={74} y={88} width={18} height={24} fill={R}  />
            <rect x={88} y={88} width={8}  height={24} fill={Rd} />
          </>
        )}

        {/* ── FONE DE OUVIDO (modo voz) ─────────────── */}
        {isVoiceMode && (
          <>
            {/* Banda fina sobre a cabeça */}
            <rect x={8}   y={0}  width={80} height={6}  fill={HP}  />
            <rect x={12}  y={1}  width={72} height={4}  fill={HPm} />
            {/* Braços descem da banda até os cups laterais */}
            <rect x={-2}  y={2}  width={14} height={14} fill={HP}  />
            <rect x={84}  y={2}  width={14} height={14} fill={HP}  />

            {/* Cup esquerdo — protrui além da borda esquerda da cabeça */}
            <g style={{ ...leftCupStyle, ...cupListenAnim }}>
              {/* Oval HP (visível contra fundo escuro) */}
              <rect x={-15} y={10} width={14} height={4}  fill={HP}  />
              <rect x={-18} y={14} width={20} height={16} fill={HP}  />
              <rect x={-15} y={30} width={14} height={4}  fill={HP}  />
              {/* HPm ring */}
              <rect x={-16} y={18} width={16} height={8}  fill={HPm} />
              <rect x={-12} y={14} width={8}  height={16} fill={HPm} />
              {/* HPc pad */}
              <rect x={-12} y={20} width={8}  height={4}  fill={HPc} />
              <rect x={-10} y={17} width={4}  height={10} fill={HPc} />
              {/* LED */}
              <rect x={-5}  y={11} width={4}  height={3}  fill="#f43f5e" />
            </g>

            {/* Cup direito — espelhado, protrui além da borda direita */}
            <g style={{ ...rightCupStyle, ...cupListenAnim }}>
              <rect x={97}  y={10} width={14} height={4}  fill={HP}  />
              <rect x={94}  y={14} width={20} height={16} fill={HP}  />
              <rect x={97}  y={30} width={14} height={4}  fill={HP}  />
              <rect x={96}  y={18} width={16} height={8}  fill={HPm} />
              <rect x={100} y={14} width={8}  height={16} fill={HPm} />
              <rect x={100} y={20} width={8}  height={4}  fill={HPc} />
              <rect x={102} y={17} width={4}  height={10} fill={HPc} />
              <rect x={97}  y={11} width={4}  height={3}  fill="#f43f5e" />
            </g>
          </>
        )}

        {/* ── BRAÇOS + TECLADO (estado typing) ─────── */}
        {isTyping && (
          <>
            <rect x={0}  y={108} width={96} height={20} fill="#4a5590" />
            <rect x={4}  y={111} width={88} height={14} fill="#6070b8" />
            <rect x={8}  y={112} width={12} height={9} fill="#8898e0" />
            <rect x={24} y={112} width={12} height={9} fill="#8898e0" />
            <rect x={40} y={112} width={12} height={9} fill="#8898e0" />
            <rect x={56} y={112} width={12} height={9} fill="#8898e0" />
            <rect x={72} y={112} width={12} height={9} fill="#8898e0" />
            <g style={{ animation: 'capivara-paw-left 0.28s ease-in-out infinite' }}>
              <rect x={0}  y={88} width={24} height={20} fill={Rd} />
              <rect x={4}  y={88} width={18} height={20} fill={R}  />
              <rect x={4}  y={100} width={18} height={8}  fill={P}  />
            </g>
            <g style={{ animation: 'capivara-paw-right 0.28s ease-in-out infinite' }}>
              <rect x={72} y={88} width={24} height={20} fill={Rd} />
              <rect x={74} y={88} width={18} height={20} fill={R}  />
              <rect x={74} y={100} width={18} height={8}  fill={P}  />
            </g>
          </>
        )}
      </svg>
    </div>
  );
};

export default CapivaraPet;
