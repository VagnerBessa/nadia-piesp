import React from 'react';

/**
 * Animated sound wave icon that responds to application state.
 * - Gently pulses when the assistant is listening.
 * - Amplifies based on audio level when the assistant is speaking.
 * - Remains static when idle.
 */
interface SoundWaveIconProps {
  className?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  audioLevel?: number;
}

const SoundWaveIcon: React.FC<SoundWaveIconProps> = ({ 
  className, 
  isListening = false, 
  isSpeaking = false, 
  audioLevel = 0 
}) => {
  // Amplify the audio level for a more noticeable visual effect and add a baseline scale.
  const scale = 1 + (audioLevel * 1.5); 

  // Apply dynamic scaling only when speaking.
  const waveStyle: React.CSSProperties = isSpeaking ? {
    // Use transform with a variable for dynamic scaling
    transform: `scaleY(${scale})`,
    transition: 'transform 0.05s ease-out', // Fast transition for responsiveness
  } : {};

  return (
    <svg
      viewBox="0 0 100 60"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      // Add a data attribute to the root SVG for state-based CSS targeting
      data-state={isListening ? 'listening' : isSpeaking ? 'speaking' : 'idle'}
    >
      {/* This style block defines the animations. */}
      <style>
        {`
          @keyframes listening-pulse {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(1.15); }
          }
          .wave-group {
            transform-origin: center;
          }
          svg[data-state='listening'] .wave-group {
            animation: listening-pulse 2.5s ease-in-out infinite;
          }
        `}
      </style>
      {/* This group wraps the waves and is the target for transformations */}
      <g className="wave-group" style={waveStyle}>
        {/* Back Wave (Lower Opacity) */}
        <g opacity="0.6">
          <path d="M5 30 C 15 10, 25 10, 40 30 C 55 5, 65 5, 75 30 C 85 15, 95 15, 100 30 Z" />
          <path d="M5 30 C 15 50, 25 50, 40 30 C 55 55, 65 55, 75 30 C 85 45, 95 45, 100 30 Z" />
        </g>
        {/* Front Wave (Full Opacity) */}
        <g opacity="1.0">
          <path d="M0 30 C 10 20, 20 20, 30 30 C 40 15, 50 15, 65 30 C 80 25, 90 25, 100 30 Z" />
          <path d="M0 30 C 10 40, 20 40, 30 30 C 40 45, 50 45, 65 30 C 80 35, 90 35, 100 30 Z" />
        </g>
      </g>
    </svg>
  );
};

export default SoundWaveIcon;