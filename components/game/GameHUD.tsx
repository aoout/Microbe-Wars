
import React, { useEffect, useState } from 'react';
import { Activity, Bot, Pause, Play } from 'lucide-react';

interface GameHUDProps {
  timeLeft: number;
  isPaused: boolean;
  onTogglePause: () => void;
  isAutoPilot: boolean;
  onToggleAutoPilot: () => void;
  hideControls?: boolean;
}

const GameHUD: React.FC<GameHUDProps> = ({
  timeLeft,
  isPaused,
  onTogglePause,
  isAutoPilot,
  onToggleAutoPilot,
  hideControls = false
}) => {
  return (
    <>
      {/* HUD - Timer (Positioned relative to the viewport/root div) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none opacity-80">
         <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-sm px-4 py-1.5 rounded-full border border-slate-700/30">
           <Activity className={`w-3 h-3 ${timeLeft < 10 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} />
           <span className="font-mono-lab text-xs text-slate-300 font-medium tracking-wide">
             周期: {timeLeft.toString().padStart(2, '0')}s
           </span>
         </div>
      </div>

      {/* HUD - Control Panel (Positioned relative to the viewport/root div) */}
      {!hideControls && (
        <div className="absolute top-4 right-4 z-50 opacity-90 flex items-center gap-2">
           <button
             onClick={onTogglePause}
             className={`
               w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-300 pointer-events-auto
               ${isPaused 
                 ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-pulse' 
                 : 'bg-slate-900/40 border-slate-700/30 text-slate-400 hover:bg-slate-800 hover:text-white hover:border-slate-500'}
             `}
           >
              {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
           </button>

           <button 
             onClick={onToggleAutoPilot}
             className={`
               flex items-center gap-2 backdrop-blur-sm px-3 py-2 rounded-full border transition-all duration-300 pointer-events-auto h-10
               ${isAutoPilot 
                 ? 'bg-blue-900/40 border-blue-500/50 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                 : 'bg-slate-900/30 border-slate-700/30 text-slate-500 hover:bg-slate-900/50 hover:text-slate-300'}
             `}
           >
             <Bot className={`w-4 h-4 ${isAutoPilot ? 'animate-pulse' : ''}`} />
             <span className="font-mono-lab text-[10px] font-bold tracking-widest hidden sm:inline">
               托管 {isAutoPilot ? '开启' : '关闭'}
             </span>
           </button>
        </div>
      )}
    </>
  );
};

export default GameHUD;
