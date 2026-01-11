
import React from 'react';

interface AudioVisualizerProps {
  isSpeaking: boolean;
  color?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isSpeaking, color = 'bg-indigo-500' }) => {
  return (
    <div className="flex items-center space-x-1 h-full flex-grow">
      {[...Array(24)].map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-300 ease-in-out ${
            isSpeaking 
              ? `${color} opacity-100 shadow-[0_0_8px_rgba(99,102,241,0.5)]` 
              : 'bg-slate-700 opacity-30'
          }`}
          style={{
            height: isSpeaking 
              ? `${Math.max(6, Math.random() * 32)}px` 
              : '4px',
            animation: isSpeaking 
              ? `activePulse ${0.4 + Math.random() * 0.4}s infinite alternate ease-in-out` 
              : `idlePulse 3s infinite ease-in-out`,
            animationDelay: `${i * 0.05}s`
          }}
        />
      ))}
      <style>{`
        @keyframes activePulse {
          0% { transform: scaleY(1); }
          100% { transform: scaleY(1.4); filter: brightness(1.2); }
        }
        @keyframes idlePulse {
          0%, 100% { transform: scaleY(1); opacity: 0.2; }
          50% { transform: scaleY(1.2); opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default AudioVisualizer;
