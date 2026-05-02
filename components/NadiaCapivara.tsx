import React from 'react';

interface NadiaCapivaraProps {
  size?: number;
  state?: 'idle' | 'watching' | 'happy';
  className?: string;
}

export const NadiaCapivara = React.memo<NadiaCapivaraProps>(({
  size = 64,
  state = 'idle',
  className = '',
}) => {
  return (
    <>
      <style>{`
        @keyframes capy-float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-4px); }
        }
        @keyframes capy-tilt {
          0%, 100% { transform: rotate(-4deg); }
          50%       { transform: rotate(4deg); }
        }
        @keyframes capy-bounce {
          0%, 100% { transform: scale(1, 1); }
          40%       { transform: scale(0.96, 1.07); }
          70%       { transform: scale(1.04, 0.95); }
        }
        .capy-idle     { animation: capy-float  3.2s ease-in-out infinite; transform-origin: center bottom; }
        .capy-watching { animation: capy-tilt   2.0s ease-in-out infinite; transform-origin: center; }
        .capy-happy    { animation: capy-bounce 0.65s ease-in-out infinite; transform-origin: center bottom; }
      `}</style>

      <div
        className={`capy-${state} ${className}`.trim()}
        style={{ display: 'inline-block', lineHeight: 0 }}
      >
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Capivara, mascote da Nadia"
          role="img"
        >
          {/* ── ear fringe (dither tops) ── */}
          <rect x="15" y="0" width="2" height="2" fill="#9F1239" opacity="0.5"/>
          <rect x="19" y="0" width="2" height="2" fill="#9F1239" opacity="0.5"/>
          <rect x="43" y="0" width="2" height="2" fill="#9F1239" opacity="0.5"/>
          <rect x="47" y="0" width="2" height="2" fill="#9F1239" opacity="0.5"/>

          {/* ── ears ── */}
          <rect x="13" y="2"  width="10" height="10" fill="#9F1239"/>
          <rect x="41" y="2"  width="10" height="10" fill="#9F1239"/>
          <rect x="15" y="4"  width="6"  height="6"  fill="#BE123C"/>
          <rect x="43" y="4"  width="6"  height="6"  fill="#BE123C"/>

          {/* ── body (drawn first so head + snout render on top) ── */}
          <rect x="6"  y="26" width="52" height="30" fill="#BE123C"/>
          <rect x="6"  y="26" width="52" height="4"  fill="#C81E4A"/>
          <rect x="6"  y="52" width="52" height="4"  fill="#9F1239"/>
          {/* body side dither */}
          {[30, 34, 38, 42, 46, 50].map(y => (
            <g key={y}>
              <rect x="4"  y={y} width="2" height="2" fill="#9F1239" opacity="0.5"/>
              <rect x="58" y={y} width="2" height="2" fill="#9F1239" opacity="0.5"/>
            </g>
          ))}

          {/* ── front legs ── */}
          <rect x="8"  y="54" width="14" height="10" fill="#9F1239"/>
          <rect x="42" y="54" width="14" height="10" fill="#9F1239"/>

          {/* ── head top fringe (between ears) ── */}
          {[24, 28, 32, 36, 40].map(x => (
            <rect key={x} x={x} y="6" width="2" height="2" fill="#E11D48" opacity="0.5"/>
          ))}

          {/* ── head (drawn over body) ── */}
          <rect x="10" y="8"  width="44" height="22" fill="#E11D48"/>
          <rect x="10" y="8"  width="4"  height="22" fill="#BE123C"/>
          <rect x="50" y="8"  width="4"  height="22" fill="#BE123C"/>
          <rect x="14" y="8"  width="36" height="4"  fill="#EC2752"/>

          {/* ── eyes ── */}
          <rect x="16" y="12" width="8" height="8" fill="#fdf4ff"/>
          <rect x="18" y="14" width="4" height="4" fill="#0f172a"/>
          <rect x="22" y="12" width="2" height="2" fill="#fdf4ff" opacity="0.5"/>
          <rect x="40" y="12" width="8" height="8" fill="#fdf4ff"/>
          <rect x="42" y="14" width="4" height="4" fill="#0f172a"/>
          <rect x="46" y="12" width="2" height="2" fill="#fdf4ff" opacity="0.5"/>

          {/* ── snout / muzzle (drawn last — visually in front of head + body) ── */}
          {/* transition row merging into head */}
          <rect x="12" y="22" width="40" height="4"  fill="#E11D48"/>
          {/* main snout block */}
          <rect x="10" y="24" width="44" height="14" fill="#F43F5E"/>
          {/* snout side shadows */}
          <rect x="10" y="24" width="4"  height="14" fill="#E11D48"/>
          <rect x="50" y="24" width="4"  height="14" fill="#E11D48"/>
          {/* snout bottom shadow row */}
          <rect x="10" y="36" width="44" height="2"  fill="#E11D48"/>

          {/* ── nostrils ── */}
          <rect x="16" y="28" width="8" height="6" fill="#4C0519"/>
          <rect x="40" y="28" width="8" height="6" fill="#4C0519"/>
          <rect x="22" y="28" width="2" height="2" fill="#7F1D1D" opacity="0.5"/>
          <rect x="46" y="28" width="2" height="2" fill="#7F1D1D" opacity="0.5"/>

          {/* snout center highlight */}
          <rect x="30" y="25" width="4" height="2" fill="#FB7185" opacity="0.5"/>

          {/* snout bottom fringe */}
          {[12, 16, 20, 24, 28, 32, 36, 40, 44, 48].map(x => (
            <rect key={x} x={x} y="38" width="2" height="2" fill="#F43F5E" opacity="0.4"/>
          ))}
        </svg>
      </div>
    </>
  );
});

NadiaCapivara.displayName = 'NadiaCapivara';

export default NadiaCapivara;
