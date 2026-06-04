import React from 'react';

export const SmallNadiaSphere: React.FC = () => {
  return (
    <>
      <style>
        {`
          @keyframes pulse-glow {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 0px rgba(224, 122, 47, 0.3);
            }
            50% {
              transform: scale(1.05);
              box-shadow: 0 0 10px rgba(224, 122, 47, 0.45);
            }
          }
          .nadia-sphere-small {
            animation: pulse-glow 2s infinite ease-in-out;
          }
        `}
      </style>
      <div 
        className="nadia-sphere-small w-6 h-6 rounded-full bg-gradient-to-br from-[#E07A2F] to-[#9A4F1B] shadow-inner"
        aria-label="Nadia is thinking"
      >
      </div>
    </>
  );
};
