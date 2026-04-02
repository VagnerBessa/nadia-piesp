import React, { useState, useEffect, useRef } from 'react';
import { DitheringShader, DitheringShape } from './DitheringShader';

interface NadiaSphereProps {
  isListening: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  audioLevel: number;
  size?: 'large' | 'medium' | 'small';
}

export const NadiaSphere: React.FC<NadiaSphereProps> = ({ isListening, isSpeaking, isConnecting, audioLevel, size = 'large' }) => {
  const [awakeningProgress, setAwakeningProgress] = useState(-1.0); // -1 denotes "not animating"
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // If we are not connecting, ensure any running animation is cancelled and the state is reset.
    if (!isConnecting) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setAwakeningProgress(-1.0);
      return; // Exit early
    }

    // If we are connecting, start the animation.
    // This part will only run when `isConnecting` becomes true.
    let startTime: number | null = null;
    const duration = 1500; // 1.5 second animation

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      
      setAwakeningProgress(progress);

      if (progress < 1.0) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null; // Animation finished
      }
    };
    
    // Kick off the animation
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup function: will be called if `isConnecting` becomes false during the animation, or on unmount.
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isConnecting]); // ONLY depend on the connection state


  // Default to idle state
  let shape: DitheringShape = 'sphere';
  let speed = 0.2;
  let colorFront = '#F43F5E'; // The sphere is always red/rose as requested.
  let pxSize = 1;
  let pulseLevel = 0;
  
  // If the awakening animation is running (progress is >= 0)
  if (awakeningProgress >= 0) { 
    speed = awakeningProgress * 0.6; // Speed ramps up with the animation progress
  } else if (isSpeaking) {
    speed = 0.9;
    pulseLevel = audioLevel;
  } else if (isListening) {
    speed = 0.6;
  }

  let containerClasses = "w-64 h-64 md:w-80 md:h-80";
  let shaderSize = 320;

  if (size === 'large') {
      containerClasses = "w-72 h-72 md:w-96 md:h-96";
      shaderSize = 384;
  } else if (size === 'small') {
      containerClasses = "w-32 h-32 md:w-40 md:h-40";
      shaderSize = 160;
  }


  return (
    <div className={`${containerClasses} rounded-full overflow-hidden flex items-center justify-center bg-black shadow-xl shadow-black/30`}>
        <DitheringShader
            width={shaderSize}
            height={shaderSize}
            shape={shape}
            speed={speed}
            colorFront={colorFront}
            colorBack="#000000"
            pxSize={pxSize}
            type="random"
            pulseLevel={pulseLevel}
            awakeningProgress={awakeningProgress} // Pass progress to the shader
        />
    </div>
  );
};