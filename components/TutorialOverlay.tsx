
import React from 'react';
import { Radio, ChevronRight, Activity, SkipForward } from 'lucide-react';
import { TutorialStep } from '../types';
import RichTypewriter from './RichTypewriter';

interface TutorialOverlayProps {
  step: TutorialStep;
  nextStep: () => void;
  skipTutorial: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  step,
  nextStep,
  skipTutorial
}) => {
  const handleOverlayClick = () => {
    if (step.requiredAction === 'NEXT' || (step.requiredAction === 'SELECT' && step.id === 0)) {
        nextStep();
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-12 z-40 flex justify-center px-4 pointer-events-none">
        <div 
          className={`
            relative max-w-4xl w-full bg-[#0a101f]/95 backdrop-blur-xl 
            border border-slate-600/50 shadow-[0_0_40px_rgba(0,0,0,0.6)] 
            pointer-events-auto transition-all duration-300
            ${step.requiredAction === 'NEXT' ? 'cursor-pointer hover:bg-[#0f1729]' : ''}
          `}
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 85%, 98% 100%, 2% 100%, 0 85%)'
          }}
          onClick={handleOverlayClick}
        >
            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>
            <div className="absolute top-3 left-3 w-2 h-2 bg-yellow-500/80 rounded-full animate-pulse"></div>
            <div className="absolute top-3 right-3 text-[10px] font-mono-lab text-slate-500 tracking-widest">TRANSMISSION_SECURE</div>

            <div className="flex flex-col md:flex-row items-stretch p-6 pb-8 gap-6">
                
                {/* Left: Hologram / Icon */}
                <div className="hidden md:flex flex-col items-center justify-center w-24 shrink-0 border-r border-slate-700/50 pr-6">
                   <div className="relative w-16 h-16 flex items-center justify-center bg-slate-900 rounded-lg border border-slate-700 shadow-inner overflow-hidden">
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10"></div>
                      <Radio className="text-yellow-500 w-8 h-8 animate-pulse" />
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-yellow-500 animate-[loading_2s_ease-in-out_infinite]"></div>
                   </div>
                   <div className="mt-2 text-[10px] text-yellow-600 font-mono tracking-tighter">HQ_LINK_ACTIVE</div>
                </div>

                {/* Center: Content */}
                <div className="flex-1 flex flex-col justify-center min-h-[100px]">
                    <div className="flex items-center gap-3 mb-3">
                       <span className="bg-yellow-500/10 text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded border border-yellow-500/20 uppercase tracking-widest">
                         Step {String(step.id + 1).padStart(2, '0')}
                       </span>
                       <h3 className="text-slate-400 font-mono-lab text-xs uppercase tracking-[0.2em]">
                         战术指导协议 // Alpha
                       </h3>
                    </div>
                    
                    <div className="text-lg md:text-xl text-slate-100 font-sans font-medium leading-relaxed tracking-wide drop-shadow-sm min-h-[3.5rem]">
                        <RichTypewriter text={step.text} />
                    </div>

                    {/* Action Prompt */}
                    {step.requiredAction === 'NEXT' && (
                        <div className="mt-4 flex items-center gap-2 text-xs text-yellow-400 font-mono animate-bounce opacity-80">
                            <ChevronRight size={14} />
                            <span className="tracking-widest uppercase border-b border-dashed border-yellow-500/50 pb-0.5">点击任意处继续</span>
                        </div>
                    )}
                    {step.requiredAction !== 'NEXT' && (
                        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 font-mono">
                            <Activity size={12} className="text-blue-400" />
                            <span className="tracking-widest uppercase">等待指令执行...</span>
                        </div>
                    )}
                </div>

                {/* Right: Controls */}
                <div className="flex flex-col justify-between items-end pl-4 border-l border-slate-700/50">
                    {/* Skip Button */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); skipTutorial(); }}
                      className="group flex items-center gap-1.5 text-slate-500 hover:text-white transition-all px-2 py-1.5 rounded-md hover:bg-slate-800"
                      title="Skip Tutorial"
                    >
                       <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">跳过</span>
                       <SkipForward size={16} />
                    </button>
                </div>
            </div>
            
            {/* Bottom: Segmented Progress Bar */}
            <div className="absolute bottom-0 left-0 w-full h-1.5 flex gap-0.5 bg-slate-900/50 px-6 pb-6 box-content">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`
                      h-1 flex-1 rounded-sm transition-all duration-500
                      ${idx <= step.id ? 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]' : 'bg-slate-800'}
                    `}
                  />
                ))}
            </div>
        </div>
    </div>
  );
};

export default TutorialOverlay;
