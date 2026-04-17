import React from 'react';

const BAR_COUNT = 15;

// Helper to interpolate between two colors
const interpolateColor = (color1: number[], color2: number[], factor: number) => {
    const result = color1.slice();
    for (let i = 0; i < 3; i++) {
        result[i] = Math.round(result[i] + factor * (color2[i] - result[i]));
    }
    return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
};

// Convert hex to RGB array
const hexToRgb = (hex: string): number[] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
};

const colors = [
    hexToRgb('#fde047'), // tailwind yellow-300
    hexToRgb('#f97316'), // tailwind orange-500
    hexToRgb('#f43f5e'), // tailwind rose-500
];

const getBarColor = (index: number) => {
    const factor = index / (BAR_COUNT - 1);
    if (factor < 0.5) {
        return interpolateColor(colors[0], colors[1], factor * 2);
    } else {
        return interpolateColor(colors[1], colors[2], (factor - 0.5) * 2);
    }
};

const IdleSoundWave: React.FC = () => {
    return (
        <>
            <style>
                {`
                @keyframes wave {
                    0%, 100% { transform: scaleY(0.2); }
                    50% { transform: scaleY(1.0); }
                }
                .wave-bar {
                    animation: wave 1.2s ease-in-out infinite;
                    transform-origin: bottom;
                }
                `}
            </style>
            <div className="w-56 h-56 md:w-64 md:h-64 flex items-center justify-center gap-1.5" aria-label="Idle sound wave animation">
                {Array.from({ length: BAR_COUNT }).map((_, index) => (
                    <div
                        key={index}
                        className="wave-bar w-2.5 h-full rounded-full"
                        style={{
                            backgroundColor: getBarColor(index),
                            animationDelay: `${index * 0.1}s`,
                        }}
                    />
                ))}
            </div>
        </>
    );
};

export default IdleSoundWave;
