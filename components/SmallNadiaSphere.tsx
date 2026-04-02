import React from 'react';

export const SmallNadiaSphere: React.FC = () => {
  return (
    <>
      <style>
        {`
          @keyframes pulse-glow {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 0px rgba(244, 63, 94, 0.4);
            }
            50% {
              transform: scale(1.05);
              box-shadow: 0 0 10px rgba(244, 63, 94, 0.7);
            }
          }
          .nadia-sphere-small {
            animation: pulse-glow 2s infinite ease-in-out;
          }
        `}
      </style>
      <div 
        className="nadia-sphere-small w-6 h-6 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 shadow-inner"
        aria-label="Nadia is thinking"
      >
      </div>
    </>
  );
};