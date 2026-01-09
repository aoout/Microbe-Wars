
import React from 'react';
import { Pause } from 'lucide-react';

interface PauseOverlayProps {
  isPaused: boolean;
  onResume: () => void;
}

const PauseOverlay: React.FC<PauseOverlayProps> = ({ isPaused, onResume }) => {
  if (!isPaused) return null;

  return (
    <div 
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer"
      onClick={onResume}
    >
        <div className="bg-slate-900/90 border-y-2 border-yellow-500/50 px-12 py-6 flex items-center gap-4 shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in duration-300 pointer-events-none">
            <Pause className="text-yellow-500 animate-pulse" size={32} />
            <div className="flex flex-col">
                <span className="text-yellow-400 font-mono-lab tracking-[0.5em] text-2xl font-bold uppercase drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">
                    SYSTEM PAUSED
                </span>
                <span className="text-yellow-600/80 font-mono-lab text-[10px] tracking-widest text-center mt-1">
                    CLICK TO RESUME
                </span>
            </div>
        </div>
    </div>
  );
};

export default PauseOverlay;
