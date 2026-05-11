import React from 'react';
import CapivaraPet from './CapivaraPet';

export function MiniGraphSVG() {
  return (
    <svg viewBox="0 0 84 60" width="84" height="60">
      <line x1="42" y1="11" x2="14" y2="40" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="42" y1="11" x2="70" y2="40" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="42" y1="11" x2="42" y2="49" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="14" y1="40" x2="42" y2="49" stroke="#334155" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="70" y1="40" x2="42" y2="49" stroke="#334155" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="14" y1="40" x2="70" y2="40" stroke="#334155" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="42" y1="11" x2="22" y2="20" stroke="#334155" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="42" y1="11" x2="62" y2="20" stroke="#334155" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="42" cy="11" r="8"   fill="#f43f5e" opacity="0.9" />
      <circle cx="14" cy="40" r="5.5" fill="#38bdf8" opacity="0.9" />
      <circle cx="70" cy="40" r="5.5" fill="#38bdf8" opacity="0.9" />
      <circle cx="42" cy="49" r="4.5" fill="#34d399" opacity="0.9" />
      <circle cx="22" cy="20" r="3.5" fill="#a78bfa" opacity="0.85" />
      <circle cx="62" cy="20" r="3"   fill="#34d399" opacity="0.85" />
    </svg>
  );
}

export function MiniDocSVG() {
  return (
    <svg viewBox="0 0 84 60" width="84" height="60">
      {/* baseline */}
      <line x1="4" y1="51" x2="80" y2="51" stroke="#475569" strokeWidth="0.8" strokeLinecap="round" />
      {/* bars */}
      <rect x="7"  y="27" width="10" height="24" rx="2" fill="#f43f5e" opacity="0.85" />
      <rect x="21" y="15" width="10" height="36" rx="2" fill="#38bdf8" opacity="0.85" />
      <rect x="35" y="33" width="10" height="18" rx="2" fill="#34d399" opacity="0.85" />
      <rect x="49" y="20" width="10" height="31" rx="2" fill="#a78bfa" opacity="0.85" />
      <rect x="63" y="10" width="10" height="41" rx="2" fill="#fb923c" opacity="0.85" />
      {/* trend line */}
      <polyline
        points="12,27 26,15 40,33 54,20 68,10"
        stroke="white" strokeWidth="1.5" fill="none" opacity="0.55"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* dots */}
      <circle cx="12" cy="27" r="2.2" fill="white" opacity="0.75" />
      <circle cx="26" cy="15" r="2.2" fill="white" opacity="0.75" />
      <circle cx="40" cy="33" r="2.2" fill="white" opacity="0.75" />
      <circle cx="54" cy="20" r="2.2" fill="white" opacity="0.75" />
      <circle cx="68" cy="10" r="2.2" fill="white" opacity="0.75" />
    </svg>
  );
}

export function MiniLineSVG() {
  return (
    <svg viewBox="0 0 84 60" width="84" height="60">
      <line x1="4" y1="15" x2="80" y2="15" stroke="#334155" strokeWidth="0.6" strokeDasharray="3,3" />
      <line x1="4" y1="32" x2="80" y2="32" stroke="#334155" strokeWidth="0.6" strokeDasharray="3,3" />
      <line x1="4" y1="50" x2="80" y2="50" stroke="#475569" strokeWidth="0.8" />
      <path d="M4,50 L4,38 L18,27 L32,19 L46,29 L60,11 L74,16 L74,50 Z"
        fill="#38bdf8" opacity="0.13" />
      <polyline points="4,38 18,27 32,19 46,29 60,11 74,16"
        stroke="#38bdf8" strokeWidth="2" fill="none"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="4"  cy="38" r="2.5" fill="#38bdf8" opacity="0.9" />
      <circle cx="18" cy="27" r="2.5" fill="#38bdf8" opacity="0.9" />
      <circle cx="32" cy="19" r="2.5" fill="#34d399" opacity="0.9" />
      <circle cx="46" cy="29" r="2.5" fill="#38bdf8" opacity="0.9" />
      <circle cx="60" cy="11" r="3.5" fill="#f43f5e" opacity="0.9" />
      <circle cx="74" cy="16" r="2.5" fill="#a78bfa" opacity="0.9" />
    </svg>
  );
}

export function MiniPieSVG() {
  return (
    <svg viewBox="0 0 84 60" width="84" height="60">
      <path d="M42,30 L42,8 A22,22 0 0,1 61,41 Z"   fill="#f43f5e" opacity="0.9" />
      <path d="M42,30 L61,41 A22,22 0 0,1 23,41 Z"   fill="#38bdf8" opacity="0.9" />
      <path d="M42,30 L23,41 A22,22 0 0,1 42,8 Z"    fill="#34d399" opacity="0.9" />
      <circle cx="42" cy="30" r="9" fill="#1e293b" />
      <circle cx="42" cy="5"  r="2.5" fill="#a78bfa" opacity="0.75" />
      <circle cx="65" cy="44" r="2.5" fill="#fb923c" opacity="0.75" />
      <circle cx="19" cy="44" r="2.5" fill="#fbbf24" opacity="0.75" />
    </svg>
  );
}

export function LoadingPetOverlay({ label, svgIcon }: { label: string; svgIcon?: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-1">
      {/* Thought bubble */}
      <div className="flex flex-col items-center">
        <div className="bg-slate-800/90 border border-slate-600/30 rounded-2xl px-5 py-4 shadow-xl backdrop-blur-sm">
          {svgIcon ?? <MiniGraphSVG />}
        </div>
        <div className="flex items-end gap-1.5 mt-1.5 mb-0.5">
          <div className="w-2 h-2 rounded-full bg-slate-700/80" />
          <div className="w-1.5 h-1.5 rounded-full bg-slate-700/50" />
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-slate-500 text-xs">{label}</span>
          <span className="flex gap-0.5">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-1 h-1 rounded-full bg-slate-600 inline-block animate-bounce"
                style={{ animationDelay: `${d}ms`, animationDuration: '1s' }} />
            ))}
          </span>
        </div>
      </div>
      <CapivaraPet state="attention" size={72} />
    </div>
  );
}
