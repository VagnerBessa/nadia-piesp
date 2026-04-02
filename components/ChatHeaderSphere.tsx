import React from 'react';
import { DitheringShader } from './DitheringShader';

/**
 * A small, animated sphere component for the chat header.
 * It uses the DitheringShader to provide a subtle, dynamic visual
 * indicating that Nadia is 'present' in the chat view.
 */
export const ChatHeaderSphere: React.FC = () => {
  return (
    // The wrapper ensures the shader is clipped into a circle.
    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-slate-900">
      <DitheringShader
        width={32}
        height={32}
        shape="sphere"
        speed={0.2} // A slow speed for a subtle idle animation
        colorFront="#F43F5E" // tailwind rose-500
        colorBack="#0f172a" // tailwind slate-900, to match the background
        pxSize={1}
        type="random"
        pulseLevel={0}
        awakeningProgress={-1.0} // -1.0 means the animation is not active
      />
    </div>
  );
};
