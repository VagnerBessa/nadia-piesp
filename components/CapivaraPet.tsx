import React from 'react';

export type PetState =
  | 'idle'
  | 'attention'
  | 'listening'
  | 'speaking'
  | 'typing'
  | 'user_typing'
  | 'supervising'   // query/sistema carregando — caminha lateralmente
  | 'waiting'       // IA processando — pestanejo lento, paciente
  | 'found'         // resultado chegou — olhar sobe brevemente
  | 'empty'         // zero resultados — olhar desce
  | 'reading';      // dashboard/perfil carregando — olhos da esq. p/ dir.

interface CapivaraPetProps {
  state?: PetState;
  size?: number;
  audioLevel?: number;
}

const R  = '#e03848';
const Rd = '#b82030';
const P  = '#f07878';
const W  = '#f4f4f4';
const N  = '#1a1f30';
const M  = '#7a1020';

const CapivaraPet: React.FC<CapivaraPetProps> = ({ state = 'idle', size = 64 }) => {
  const isListening    = state === 'listening';
  const isSpeaking     = state === 'speaking';
  const isAttention    = state === 'attention';
  const isTyping       = state === 'typing';
  const isUserTyping   = state === 'user_typing';
  const isSupervising  = state === 'supervising';
  const isWaiting      = state === 'waiting';
  const isFound        = state === 'found';
  const isEmpty        = state === 'empty';
  const isReading      = state === 'reading';

  // Direção das pupilas por estado
  let pupilDX = 0;
  let pupilDY = 0;
  if (isSpeaking)                        { pupilDX = 5;  pupilDY = -4; }
  else if (isAttention || isFound)       { pupilDX = 0;  pupilDY = -3; }
  else if (isTyping || isUserTyping || isEmpty) { pupilDX = 0; pupilDY = 5; }

  // Animação do wrapper
  let wrapperAnim: string;
  if (isAttention)      wrapperAnim = 'capivara-look-up 1.2s ease-in-out infinite';
  else if (isListening) wrapperAnim = 'capivara-breathe 3.5s ease-in-out infinite';
  else if (isSpeaking)  wrapperAnim = 'capivara-breathe 3.5s ease-in-out infinite';
  else if (isTyping)    wrapperAnim = 'capivara-breathe 2s ease-in-out infinite';
  else if (isUserTyping) wrapperAnim = 'capivara-breathe 3s ease-in-out infinite';
  else if (isSupervising) wrapperAnim = 'capivara-patrol 4s ease-in-out infinite';
  else if (isWaiting)   wrapperAnim = 'capivara-breathe 5s ease-in-out infinite';
  else if (isFound)     wrapperAnim = 'capivara-breathe 3.5s ease-in-out infinite';
  else if (isEmpty)     wrapperAnim = 'capivara-breathe 4s ease-in-out infinite';
  else if (isReading)   wrapperAnim = 'capivara-breathe 4s ease-in-out infinite';
  else wrapperAnim = 'capivara-breathe 3.5s ease-in-out infinite, capivara-tilt 6s ease-in-out 1s infinite';

  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
    transformOrigin: 'center 90%',
    imageRendering: 'pixelated',
    animation: wrapperAnim,
  };

  // Pestanejo: lento no waiting/idle, normal nos demais
  const blinkAnim     = (isAttention || isWaiting) ? 'capivara-blink-slow' : 'capivara-blink';
  const blinkDuration = (isAttention || isWaiting) ? '8s' : '4.5s';

  // Olho dart: idle → random; supervising → varre esq→dir continuamente; reading → suave esq→dir
  let eyeDartStyle: React.CSSProperties | undefined;
  if (state === 'idle') {
    eyeDartStyle = { animation: 'capivara-eye-dart 5s ease-in-out 1s infinite' };
  } else if (isSupervising) {
    eyeDartStyle = { animation: 'capivara-eye-scan 2.4s linear infinite' };
  } else if (isReading) {
    eyeDartStyle = { animation: 'capivara-eye-read 3.5s ease-in-out infinite' };
  }

  return (
    <div style={wrapperStyle}>
      <svg
        viewBox="0 0 96 128"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', imageRendering: 'pixelated' }}
      >
        {/* ── ORELHAS ─────────────────────────────── */}
        <rect x={10} y={0}  width={20} height={20} fill={Rd} />
        <rect x={14} y={4}  width={12} height={14} fill={R}  />
        <rect x={66} y={0}  width={20} height={20} fill={Rd} />
        <rect x={70} y={4}  width={12} height={14} fill={R}  />

        {/* ── CABEÇA ──────────────────────────────── */}
        <rect x={0}  y={10} width={8}  height={70} fill={Rd} />
        <rect x={4}  y={8}  width={88} height={72} fill={R}  />
        <rect x={88} y={10} width={8}  height={70} fill={Rd} />

        {/* ── OLHOS ───────────────────────────────── */}
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

        {/* ── FOCINHO ─────────────────────────────── */}
        <rect x={8}  y={52} width={80} height={26} fill={P} />
        <rect x={20} y={57} width={14} height={16} fill={M} />
        <rect x={62} y={57} width={14} height={16} fill={M} />

        {/* ── CORPO ───────────────────────────────── */}
        <rect x={0}  y={76} width={8}  height={22} fill={Rd} />
        <rect x={4}  y={76} width={88} height={22} fill={R}  />
        <rect x={88} y={76} width={8}  height={22} fill={Rd} />

        {/* ── PERNAS ──────────────────────────────── */}
        {!isTyping && (
          <>
            <rect x={0}  y={88} width={8}  height={24} fill={Rd} />
            <rect x={4}  y={88} width={18} height={24} fill={R}  />
            <rect x={74} y={88} width={18} height={24} fill={R}  />
            <rect x={88} y={88} width={8}  height={24} fill={Rd} />
          </>
        )}

        {/* ── BRAÇOS + TECLADO (estado typing) ────── */}
        {isTyping && (
          <>
            <rect x={0}  y={108} width={96} height={20} fill="#4a5590" />
            <rect x={4}  y={111} width={88} height={14} fill="#6070b8" />
            <rect x={8}  y={112} width={12} height={9}  fill="#8898e0" />
            <rect x={24} y={112} width={12} height={9}  fill="#8898e0" />
            <rect x={40} y={112} width={12} height={9}  fill="#8898e0" />
            <rect x={56} y={112} width={12} height={9}  fill="#8898e0" />
            <rect x={72} y={112} width={12} height={9}  fill="#8898e0" />
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
