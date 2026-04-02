import React, { useState } from 'react';
import { Box } from '@mui/material';

// Data mapping for regional bubbles
// Coordinates (x, y) are percentage-based on a 0-100 viewBox
const REGION_DATA = [
  { name: 'RMSP', value: 311904, x: 74, y: 68 },
  { name: 'Campinas', value: 69233, x: 68, y: 58 },
  { name: 'Sorocaba', value: 23526, x: 58, y: 72 },
  { name: 'S. J. Campos', value: 23397, x: 84, y: 60 },
  { name: 'Santos', value: 16235, x: 78, y: 78 },
  { name: 'Rib. Preto', value: 14754, x: 58, y: 28 },
  { name: 'S. J. R. Preto', value: 14285, x: 42, y: 22 },
  { name: 'Bauru', value: 8563, x: 48, y: 55 },
  { name: 'Marília', value: 7808, x: 38, y: 58 },
  { name: 'Pres. Prudente', value: 5863, x: 22, y: 60 },
  { name: 'Araçatuba', value: 5559, x: 30, y: 38 },
  { name: 'Franca', value: 6811, x: 65, y: 18 },
  { name: 'Central', value: 14754, x: 58, y: 45 }, // Araraquara/Sao Carlos approx
  { name: 'Barretos', value: 3271, x: 52, y: 15 },
  { name: 'Registro', value: 1338, x: 55, y: 88 },
  { name: 'Itapeva', value: 2821, x: 45, y: 82 },
];

// Stylized path approximating Sao Paulo state shape
const SP_SVG_PATH = "M86.3,58.8 L92.7,64.2 L83.7,78.1 L73.2,74.9 L67.6,83.1 L58.9,81.4 L46.4,76.5 L31.4,71.6 L18.6,68.4 L8.8,59.3 L16.9,46.2 L31.4,24.1 L49.9,19.3 L63.6,26.5 L73.2,35.6 L86.3,58.8 Z";

export const SaoPauloMap: React.FC = () => {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  // Helper to scale bubble size based on value
  const getRadius = (value: number) => {
    const minR = 2;
    const maxR = 18; // Max radius for RMSP
    const maxVal = 311904;
    const minVal = 1338;
    
    // Logarithmic scale to handle the huge disparity of RMSP vs others
    const scale = (Math.log(value) - Math.log(minVal)) / (Math.log(maxVal) - Math.log(minVal));
    return minR + scale * (maxR - minR);
  };

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 100 100" className="w-full h-full" style={{ maxHeight: '100%', maxWidth: '100%' }}>
        <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
             <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(34, 211, 238, 0.15)" />
                <stop offset="100%" stopColor="rgba(34, 211, 238, 0.05)" />
            </linearGradient>
            <radialGradient id="bubbleGradient">
                <stop offset="0%" stopColor="rgba(244, 63, 94, 0.9)" />
                <stop offset="100%" stopColor="rgba(244, 63, 94, 0.4)" />
            </radialGradient>
        </defs>
        
        {/* State Outline */}
        <path 
            d={SP_SVG_PATH} 
            fill="url(#mapGradient)" 
            stroke="rgba(34, 211, 238, 0.5)" 
            strokeWidth="0.5"
            filter="url(#glow)"
        />

        {/* Bubbles */}
        {REGION_DATA.map((region) => {
            const radius = getRadius(region.value);
            const isHovered = hoveredRegion === region.name;
            
            return (
                <g 
                    key={region.name} 
                    onMouseEnter={() => setHoveredRegion(region.name)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    style={{ cursor: 'pointer' }}
                >
                    <circle 
                        cx={region.x} 
                        cy={region.y} 
                        r={radius} 
                        fill={isHovered ? "#f43f5e" : "url(#bubbleGradient)"}
                        stroke="#fff"
                        strokeWidth={isHovered ? "0.5" : "0.2"}
                        opacity={isHovered ? 1 : 0.8}
                        style={{ transition: 'all 0.3s ease' }}
                    />
                    
                    {/* Always show label for large regions or when hovered */}
                    {(region.value > 60000 || isHovered) && (
                         <text 
                            x={region.x} 
                            y={region.y - radius - 2} 
                            textAnchor="middle" 
                            fill="#fff" 
                            fontSize={isHovered ? "4" : "3"}
                            fontWeight="bold"
                            style={{ pointerEvents: 'none', textShadow: '0 0 3px black' }}
                        >
                            {region.name}
                        </text>
                    )}
                    
                    {/* Show value on hover */}
                    {isHovered && (
                         <text 
                            x={region.x} 
                            y={region.y + radius + 4} 
                            textAnchor="middle" 
                            fill="#cbd5e1" 
                            fontSize="3"
                            style={{ pointerEvents: 'none', textShadow: '0 0 3px black' }}
                        >
                            {region.value.toLocaleString()}
                        </text>
                    )}
                </g>
            );
        })}
      </svg>
      
      {/* Legend / Info */}
      <Box sx={{ position: 'absolute', bottom: 10, left: 10, pointerEvents: 'none' }}>
        <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-rose-500/80 border border-white/50"></div>
            <span className="text-[10px] text-slate-400">Volume de Empresas</span>
        </div>
      </Box>
    </Box>
  );
};
