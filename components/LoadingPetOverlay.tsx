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

export function LoadingPetOverlay({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-1">
      {/* Thought bubble */}
      <div className="flex flex-col items-center">
        <div className="bg-slate-800/90 border border-slate-600/30 rounded-2xl px-5 py-4 shadow-xl backdrop-blur-sm">
          <MiniGraphSVG />
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
      <CapivaraPet state="attention" withGlasses size={72} />
    </div>
  );
}
