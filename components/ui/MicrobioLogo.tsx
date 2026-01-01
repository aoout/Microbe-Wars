
import React from 'react';

const MicrobioLogo = ({ size = 48, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    className={`overflow-visible ${className}`}
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
       <radialGradient id="core-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
       </radialGradient>
    </defs>
    
    {/* Outer Membrane Ring (Spinning) */}
    <g className="animate-[spin_12s_linear_infinite] origin-center">
       <circle cx="50" cy="50" r="42" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 8" opacity="0.4" />
       <circle cx="50" cy="50" r="46" stroke="#a855f7" strokeWidth="1" strokeDasharray="15 10" opacity="0.3" />
    </g>

    {/* Inner Connections (Pulsing) */}
    <g className="animate-pulse">
        <line x1="50" y1="50" x2="50" y2="10" stroke="#3b82f6" strokeWidth="2" opacity="0.3" />
        <line x1="50" y1="50" x2="85" y2="70" stroke="#3b82f6" strokeWidth="2" opacity="0.3" />
        <line x1="50" y1="50" x2="15" y2="70" stroke="#3b82f6" strokeWidth="2" opacity="0.3" />
    </g>

    {/* Orbiting Particles */}
    <g className="animate-[spin_4s_linear_infinite] origin-center">
       <circle cx="50" cy="8" r="5" fill="#ef4444" className="drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
    </g>
    <g className="animate-[spin_6s_linear_reverse_infinite] origin-center">
       <circle cx="50" cy="92" r="4" fill="#a855f7" className="drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
    </g>

    {/* Central Core */}
    <circle cx="50" cy="50" r="20" fill="url(#core-glow)" className="animate-[pulse_3s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
    <circle cx="50" cy="50" r="10" fill="white" opacity="0.8" className="mix-blend-overlay" />
  </svg>
);

export default MicrobioLogo;
