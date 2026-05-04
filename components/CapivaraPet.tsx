import React from 'react';

export type PetState = 'idle' | 'attention' | 'listening' | 'speaking';

interface CapivaraPetProps {
  state?: PetState;
  size?: number;
}

// Cores do pixel art
const R  = '#e03848'; // vermelho principal
const Rd = '#b82030'; // vermelho escuro (sombras, laterais)
const Rs = '#c83040'; // vermelho médio (transições)
const P  = '#f07878'; // rosa/focinho
const W  = '#f4f4f4'; // branco dos olhos
const N  = '#1a1f30'; // azul-escuro das pupilas
const M  = '#7a1020'; // marrom escuro das narinas


const CapivaraPet: React.FC<CapivaraPetProps> = ({ state = 'idle', size = 64 }) => {
  const isListening = state === 'listening';
  const isSpeaking  = state === 'speaking';
  const isAttention = state === 'attention';

  // listening: olha para frente (pupilas centradas)
  // speaking:  olha para a esfera no canto superior direito (pupilas direita+cima)
  // attention: olha para cima (chat acima do pet)
  const pupilDX = isSpeaking ? 5 : 0;
  const pupilDY = isAttention ? -3 : isSpeaking ? -2 : 0;

  let wrapperAnim: string;
  if (isAttention)      wrapperAnim = 'capivara-look-up 1.2s ease-in-out infinite';
  else if (isListening) wrapperAnim = 'capivara-breathe 3.5s ease-in-out infinite';
  else if (isSpeaking)  wrapperAnim = 'capivara-breathe 3.5s ease-in-out infinite';
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

  /*
   * ViewBox: 0 0 96 112  (12 cols × 14 rows, cada célula = 8px)
   *
   * Layout do pixel art (baseado na imagem):
   *   Orelhas:  topo esquerdo e direito (y=0-16)
   *   Cabeça:   y=8-80 (quase toda a altura)
   *   Olhos:    y=26-46 (esquerdo x=12-28, direito x=60-76)
   *   Focinho:  y=52-76 (x=8-88)
   *   Narinas:  y=56-72 dentro do focinho
   *   Corpo:    y=76-96
   *   Pernas:   y=88-112 (cantos)
   */

  return (
    <div style={wrapperStyle}>
        <svg
          viewBox="0 0 96 112"
          width={size}
          height={size}
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', imageRendering: 'pixelated' }}
        >
          {/* ── ORELHAS ───────────────────────────────── */}
          {/* Orelha esquerda — contorno escuro + fill vermelho */}
          <rect x={10} y={0}  width={20} height={20} fill={Rd} />
          <rect x={14} y={4}  width={12} height={14} fill={R}  />

          {/* Orelha direita */}
          <rect x={66} y={0}  width={20} height={20} fill={Rd} />
          <rect x={70} y={4}  width={12} height={14} fill={R}  />

          {/* ── CABEÇA ────────────────────────────────── */}
          {/* Sombra lateral esquerda */}
          <rect x={0}  y={10} width={8}  height={70} fill={Rd} />
          {/* Corpo principal da cabeça */}
          <rect x={4}  y={8}  width={88} height={72} fill={R}  />
          {/* Sombra lateral direita */}
          <rect x={88} y={10} width={8}  height={70} fill={Rd} />

          {/* ── OLHOS ─────────────────────────────────── */}
          <rect x={12} y={26} width={22} height={22} fill={W} />
          <rect x={62} y={26} width={22} height={22} fill={W} />
          {/* Pupilas agrupadas — eye dart no idle */}
          <g style={eyeDartStyle}>
            <rect x={18 + pupilDX} y={30 + pupilDY} width={12} height={14} fill={N} />
            <rect x={66 + pupilDX} y={30 + pupilDY} width={12} height={14} fill={N} />
          </g>

          {/* Pálpebra esquerda (sobreposição vermelha — piscar) */}
          <rect
            x={12} y={26} width={22} height={22}
            fill={R}
            style={{
              opacity: 0,
              animation: `${blinkAnim} ${blinkDuration} ease-in-out 0.3s infinite`,
            }}
          />
          {/* Pálpebra direita */}
          <rect
            x={62} y={26} width={22} height={22}
            fill={R}
            style={{
              opacity: 0,
              animation: `${blinkAnim} ${blinkDuration} ease-in-out 0.42s infinite`,
            }}
          />

          {/* ── FOCINHO / MUZZLE ──────────────────────── */}
          <rect x={8}  y={52} width={80} height={26} fill={P} />

          {/* Narina esquerda */}
          <rect x={20} y={57} width={14} height={16} fill={M} />
          {/* Narina direita */}
          <rect x={62} y={57} width={14} height={16} fill={M} />

          {/* ── CORPO ─────────────────────────────────── */}
          <rect x={0}  y={76} width={8}  height={22} fill={Rd} />
          <rect x={4}  y={76} width={88} height={22} fill={R}  />
          <rect x={88} y={76} width={8}  height={22} fill={Rd} />

          {/* ── PERNAS ────────────────────────────────── */}
          {/* Perna esquerda */}
          <rect x={0}  y={88} width={8}  height={24} fill={Rd} />
          <rect x={4}  y={88} width={18} height={24} fill={R}  />

          {/* Perna direita */}
          <rect x={74} y={88} width={18} height={24} fill={R}  />
          <rect x={88} y={88} width={8}  height={24} fill={Rd} />
        </svg>
      </div>
  );
};

export default CapivaraPet;
