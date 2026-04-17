import React from 'react';
import { DitheringShader } from './DitheringShader';

/**
 * A small, animated sphere component for the chat header.
 * It uses the DitheringShader to provide a subtle, dynamic visual
 * indicating that Nadia is 'present' in the chat view.
 */
interface ChatHeaderSphereProps {
  size?: number;
}

export const ChatHeaderSphere: React.FC<ChatHeaderSphereProps> = ({ size = 32 }) => {
  return (
    // The wrapper ensures the shader is clipped into a circle.
    <div 
      className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-slate-900 border border-white/5"
      style={{ width: size, height: size }}
    >
      <DitheringShader
        width={size}
        height={size}
        shape="sphere"
        speed={0.2} // A slow speed for a subtle idle animation
        colorFront="#F43F5E" // rose-500
        colorBack="#020617" // slate-950
        pxSize={1}
        type="random"
        pulseLevel={0}
        awakeningProgress={-1.0} // -1.0 means the animation is not active
      />
    </div>
  );
};
