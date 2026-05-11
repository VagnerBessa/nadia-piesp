import React from 'react';

export type PetState =
  | 'idle'
  | 'attention'
  | 'listening'
  | 'speaking'
  | 'typing'
  | 'user_typing'
  | 'supervising'   // query/sistema carregando — caminha lateralmente
  | 'analyzing'     // analisando dados — pata varre gráfico imaginário
  | 'waiting'       // IA processando — pestanejo lento, paciente
  | 'found'         // resultado chegou — olhar sobe brevemente
  | 'empty'         // zero resultados — olhar desce
  | 'reading';      // dashboard/perfil carregando — olhos da esq. p/ dir.

interface CapivaraPetProps {
  state?: PetState;
  size?: number;
  audioLevel?: number;
  eyeAnim?: string;
  withGlasses?: boolean;
}

const R  = '#e03848';
const Rd = '#b82030';
const P  = '#f07878';
const W  = '#f4f4f4';
const N  = '#1a1f30';
const M  = '#7a1020';

const CapivaraPet: React.FC<CapivaraPetProps> = ({ state = 'idle', size = 64, eyeAnim, withGlasses = false }) => {
  const isListening    = state === 'listening';
  const isSpeaking     = state === 'speaking';
  const isAttention    = state === 'attention';
  const isTyping       = state === 'typing';
  const isUserTyping   = state === 'user_typing';
  const isSupervising  = state === 'supervising';
  const isAnalyzing    = state === 'analyzing';
  const isWaiting      = state === 'waiting';
  const isFound        = state === 'found';
  const isEmpty        = state === 'empty';
  const isReading      = state === 'reading';

  // Direção das pupilas por estado
  let pupilDX = 0;
  let pupilDY = 0;
  if (isSpeaking)                        { pupilDX = 5;  pupilDY = -4; }
  else if (isAttention || isFound)       { pupilDX = 0;  pupilDY = -3; }
  else if (isReading)                           { pupilDX = 0; pupilDY = 4; }
  else if (isTyping || isUserTyping || isEmpty) { pupilDX = 0; pupilDY = 5; }
  else if (isAnalyzing)                        { pupilDX = 0; pupilDY = 4; }

  // Animação do wrapper
  let wrapperAnim: string;
  if (isAttention)      wrapperAnim = 'capivara-look-up 1.2s ease-in-out infinite';
  else if (isListening) wrapperAnim = 'capivara-breathe 3.5s ease-in-out infinite';
  else if (isSpeaking)  wrapperAnim = 'capivara-breathe 3.5s ease-in-out infinite';
  else if (isTyping)    wrapperAnim = 'capivara-breathe 2s ease-in-out infinite';
  else if (isUserTyping) wrapperAnim = 'capivara-breathe 3s ease-in-out infinite';
  else if (isSupervising) wrapperAnim = 'capivara-patrol 6s ease-in-out infinite';
  else if (isAnalyzing)  wrapperAnim = 'capivara-breathe 3.2s ease-in-out infinite';
  else if (isWaiting)   wrapperAnim = 'capivara-breathe 5s ease-in-out infinite';
  else if (isFound)     wrapperAnim = 'capivara-breathe 3.5s ease-in-out infinite';
  else if (isEmpty)     wrapperAnim = 'capivara-breathe 4s ease-in-out infinite';
  else if (isReading)   wrapperAnim = 'capivara-breathe 4s ease-in-out infinite';
  else wrapperAnim = 'capivara-breathe 4.3s ease-in-out infinite, capivara-tilt 11.7s ease-in-out 2.1s infinite';

  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
    transformOrigin: 'center 90%',
    imageRendering: 'pixelated',
    animation: wrapperAnim,
  };

  // Pestanejo: lento no waiting/idle, normal nos demais
  const blinkAnim     = (isAttention || isWaiting) ? 'capivara-blink-slow' : 'capivara-blink';
  const blinkDuration = (isAttention || isWaiting) ? '14s' : '8.3s';

  // Olho dart: idle → random; supervising → varre esq→dir continuamente; reading → suave esq→dir
  let eyeDartStyle: React.CSSProperties | undefined;
  if (eyeAnim) {
    eyeDartStyle = { animation: eyeAnim };
  } else if (state === 'idle') {
    eyeDartStyle = { animation: 'capivara-eye-dart 9.7s ease-in-out 3.2s infinite' };
  } else if (isSupervising) {
    eyeDartStyle = { animation: 'capivara-eye-scan 2.4s linear infinite' };
  } else if (isAnalyzing) {
    eyeDartStyle = { animation: 'capivara-eye-scan 2.1s linear infinite' };
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
          style={{ opacity: 0, animation: `${blinkAnim} ${blinkDuration} ease-in-out 0.55s infinite` }} />

        {/* ── ÓCULOS (fade-in via opacity) ────────── */}
        <g style={{ opacity: withGlasses ? 1 : 0, transition: 'opacity 0.45s ease-in' }}>
          <rect x={10} y={24} width={26} height={26} fill="none" stroke="#111827" strokeWidth={3}/>
          <rect x={60} y={24} width={26} height={26} fill="none" stroke="#111827" strokeWidth={3}/>
          <rect x={36} y={33} width={24} height={4}  fill="#111827"/>
          <rect x={0}  y={33} width={10} height={4}  fill="#111827"/>
          <rect x={86} y={33} width={10} height={4}  fill="#111827"/>
        </g>

        {/* ── FOCINHO ─────────────────────────────── */}
        <rect x={8}  y={52} width={80} height={26} fill={P} />
        <rect x={20} y={57} width={14} height={16} fill={M} />
        <rect x={62} y={57} width={14} height={16} fill={M} />

        {/* ── CORPO ───────────────────────────────── */}
        <rect x={0}  y={76} width={8}  height={22} fill={Rd} />
        <rect x={4}  y={76} width={88} height={22} fill={R}  />
        <rect x={88} y={76} width={8}  height={22} fill={Rd} />

        {/* ── PERNAS ──────────────────────────────── */}
        {!isTyping && !isAnalyzing && (
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
        {/* ── BRAÇOS + LIVRO (estado reading) ─────── */}
        {isReading && (
          <>
            {/* lombada do livro */}
            <rect x={44} y={105} width={8}  height={23} fill="#4a1e0a" />
            <rect x={46} y={106} width={4}  height={21} fill="#6b2e12" />
            {/* página esquerda */}
            <rect x={2}  y={108} width={42} height={18} fill="#f2e8d0" />
            <rect x={40} y={108} width={4}  height={18} fill="#d8cdb4" />
            {/* página direita */}
            <rect x={52} y={108} width={42} height={18} fill="#f8f2e4" />
            <rect x={52} y={108} width={4}  height={18} fill="#d8cdb4" />
            {/* linhas de texto — esq */}
            <rect x={6}  y={112} width={28} height={2} fill="#b8a888" />
            <rect x={6}  y={116} width={22} height={2} fill="#b8a888" />
            <rect x={6}  y={120} width={26} height={2} fill="#b8a888" />
            {/* linhas de texto — dir */}
            <rect x={56} y={112} width={28} height={2} fill="#b8a888" />
            <rect x={56} y={116} width={23} height={2} fill="#b8a888" />
            <rect x={56} y={120} width={26} height={2} fill="#b8a888" />
            {/* pata esquerda */}
            <rect x={0}  y={90} width={8}  height={20} fill={Rd} />
            <rect x={4}  y={90} width={16} height={20} fill={R}  />
            <rect x={4}  y={102} width={16} height={8}  fill={P}  />
            {/* pata direita */}
            <rect x={76} y={90} width={16} height={20} fill={R}  />
            <rect x={76} y={102} width={16} height={8}  fill={P}  />
            <rect x={88} y={90} width={8}  height={20} fill={Rd} />
          </>
        )}
        {/* ── BRAÇOS + GRÁFICO (estado analyzing) ─── */}
        {isAnalyzing && (
          <>
            {/* painel escuro do gráfico */}
            <rect x={0}  y={108} width={96} height={20} fill="#0d1b2a" />
            {/* linha de base */}
            <rect x={2}  y={124} width={92} height={2}  fill="#1e3a5f" />
            {/* barras do gráfico */}
            <rect x={8}  y={117} width={11} height={7}  fill="#3b82f6" />
            <rect x={23} y={113} width={11} height={11} fill="#60a5fa" />
            <rect x={38} y={110} width={11} height={14} fill="#2563eb" />
            <rect x={53} y={115} width={11} height={9}  fill="#1d4ed8" />
            <rect x={68} y={119} width={11} height={5}  fill="#93c5fd" />
            {/* pata direita estática */}
            <rect x={74} y={88} width={18} height={24} fill={R}  />
            <rect x={88} y={88} width={8}  height={24} fill={Rd} />
            {/* pata esquerda varre o gráfico */}
            <g style={{ animation: 'capivara-analyze-paw 2.8s ease-in-out infinite' }}>
              <rect x={0}  y={88} width={8}  height={24} fill={Rd} />
              <rect x={4}  y={88} width={18} height={24} fill={R}  />
              <rect x={4}  y={100} width={18} height={8}  fill={P}  />
            </g>
          </>
        )}
      </svg>
    </div>
  );
};

export default CapivaraPet;
