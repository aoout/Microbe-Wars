
import React, { useState, useEffect, useMemo } from 'react';
import { RotateCcw, Award, Skull, Dna, Activity, Globe, Cpu, GraduationCap, ChevronRight, X, Radio } from 'lucide-react';
import { useGameEngine } from './hooks/useGameEngine';
import GameMap from './components/GameMap';
import { COLOR_MAP, PLAYABLE_COLORS, DIFFICULTY_SETTINGS } from './constants';
import { DifficultyLevel } from './types';

// Improved Typewriter Component with Markdown Support
const RichTypewriter = ({ text, speed = 20 }: { text: string, speed?: number }) => {
  const [visibleCount, setVisibleCount] = useState(0);

  // Reset counter when text changes
  useEffect(() => {
    setVisibleCount(0);
  }, [text]);

  // Timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleCount(prev => {
        if (prev < text.length) {
          return prev + 1;
        }
        clearInterval(timer);
        return prev;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  // Parsing and Rendering Logic
  const renderedContent = useMemo(() => {
    // Split by markdown bold syntax: **text**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    let currentGlobalIndex = 0;
    
    return parts.map((part, index) => {
      const isBold = part.startsWith('**') && part.endsWith('**');
      // Remove asterisks for content if bold
      const content = isBold ? part.slice(2, -2) : part;
      const partLength = content.length;
      
      // Calculate how much of this part is visible based on global visibleCount
      // We map the "raw text length" (minus asterisks) to the visibleCount
      // Actually, to make it smooth, let's treat the asterisks as "instant" or just map visibleCount to the cleaned string length.
      // Simpler approach: Map visibleCount to the CLEARED string, not the raw string with **.
      
      // Wait, to keep it simple and consistent with the counter:
      // Let's assume visibleCount represents characters of the *final visible string*.
      
      if (currentGlobalIndex >= visibleCount) {
        return null; // This part hasn't started typing yet
      }

      const charIndexInPart = visibleCount - currentGlobalIndex;
      const textToRender = content.slice(0, Math.min(content.length, charIndexInPart));
      
      currentGlobalIndex += partLength;

      if (textToRender.length === 0) return null;

      if (isBold) {
        return (
          <span key={index} className="text-yellow-400 font-bold drop-shadow-[0_0_8px_rgba(250,204,21,0.6)] animate-pulse-fast">
            {textToRender}
          </span>
        );
      }
      return <span key={index}>{textToRender}</span>;
    });
  }, [text, visibleCount]);

  // Adjust visibleCount target to be the length of the CLEANED string
  const cleanLength = useMemo(() => text.replace(/\*\*/g, '').length, [text]);
  
  // Override the timer effect to use cleanLength instead of raw text.length
  useEffect(() => {
      // Clear previous timer from the simpler effect above
      // We need a specific effect for the clean length logic
      const timer = setInterval(() => {
        setVisibleCount(prev => {
          if (prev < cleanLength) {
            return prev + 1;
          }
          clearInterval(timer);
          return prev;
        });
      }, speed);
      return () => clearInterval(timer);
  }, [text, speed, cleanLength]);

  return <span>{renderedContent}</span>;
};

const App: React.FC = () => {
  const {
    gameState,
    world,
    playerColor,
    setPlayerColor,
    difficulty,
    setDifficulty,
    winner,
    nextCurrentTime,
    startGame,
    resetGame,
    handleAttack,
    isPlayerAutoPilot,
    toggleAutoPilot,
    tutorialStep,
    nextTutorialStep,
    hasCompletedTutorial
  } = useGameEngine();

  // Handle click on the overlay for tutorial progression
  const handleOverlayClick = () => {
      if (tutorialStep && (tutorialStep.requiredAction === 'NEXT' || (tutorialStep.requiredAction === 'SELECT' && tutorialStep.id === 0))) {
          nextTutorialStep();
      }
  };

  return (
    <div className="w-full h-screen flex flex-col font-sans overflow-hidden relative selection:bg-blue-500/30">
      
      {/* Menu Screen */}
      {gameState === 'MENU' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="max-w-xl w-full p-1 bg-slate-900/60 backdrop-blur-xl rounded-xl border border-slate-700 shadow-2xl relative group">
            
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-30 blur group-hover:opacity-50 transition duration-1000"></div>
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400 rounded-tl-xl"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400 rounded-br-xl"></div>

            <div className="relative bg-[#050b14] p-8 rounded-xl overflow-hidden">
               <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

               <div className="flex flex-col items-center relative z-10">
                 <div className="mb-4 p-4 rounded-full border border-blue-500/30 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <Dna size={48} className="text-blue-400 animate-pulse" />
                 </div>

                 <h1 className="text-6xl font-black mb-2 tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-blue-400 to-purple-400 uppercase drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                    微生物
                 </h1>
                 <h2 className="text-2xl font-light tracking-[0.5em] text-slate-400 mb-8 border-b border-slate-800 pb-2">
                    战争
                 </h2>

                 {/* Color Selection */}
                 <div className="w-full bg-slate-900/50 p-4 rounded-lg border border-slate-800 mb-4">
                   <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                     <Activity size={12}/> 选择基因毒株
                   </label>
                   <div className="flex justify-center gap-4">
                     {PLAYABLE_COLORS.map(c => (
                       <button
                         key={c}
                         onClick={() => setPlayerColor(c)}
                         className={`
                             w-10 h-10 rounded-full border-2 transition-all duration-300 relative group
                             ${playerColor === c 
                               ? 'border-white scale-110 shadow-[0_0_20px_currentColor]' 
                               : 'border-slate-700 opacity-50 hover:opacity-100 hover:scale-110 hover:border-slate-500'}
                         `}
                         style={{ color: COLOR_MAP[c], backgroundColor: playerColor === c ? COLOR_MAP[c] : 'transparent' }}
                       >
                           <div className={`absolute inset-2 rounded-full ${playerColor === c ? 'bg-white/30' : 'bg-current opacity-20'}`}></div>
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* Difficulty Selection */}
                 <div className="w-full bg-slate-900/50 p-4 rounded-lg border border-slate-800 mb-6">
                   <label className="block text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                     <Cpu size={12}/> 难度
                   </label>
                   <div className="grid grid-cols-6 gap-2">
                     {([1, 2, 3, 4, 5, 6] as DifficultyLevel[]).map((level) => (
                        <button
                          key={level}
                          onClick={() => setDifficulty(level)}
                          className={`
                            py-2 rounded border font-mono text-sm transition-all
                            ${difficulty === level
                              ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                              : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'}
                          `}
                          title={DIFFICULTY_SETTINGS[level].name}
                        >
                          {level}
                        </button>
                     ))}
                   </div>
                   <div className="mt-3 text-center h-8">
                      <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">{DIFFICULTY_SETTINGS[difficulty].name}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{DIFFICULTY_SETTINGS[difficulty].description}</p>
                   </div>
                 </div>

                 <div className="flex gap-4 w-full">
                    {!hasCompletedTutorial && (
                        <button
                          onClick={() => startGame(true)}
                          className="flex-1 py-4 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-200 border border-yellow-500/50 rounded-lg font-bold text-lg tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(234,179,8,0.2)] flex items-center justify-center gap-2 animate-pulse"
                        >
                           <GraduationCap size={20} />
                           新手教程
                        </button>
                    )}
                    
                    <button
                      onClick={() => startGame(false)}
                      className={`
                        flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] border border-blue-400/50 flex items-center justify-center gap-3 group-hover:gap-4
                        ${!hasCompletedTutorial ? 'opacity-80' : ''}
                      `}
                    >
                      <Globe size={20} className="animate-spin-slow" />
                      启动序列
                    </button>
                 </div>
                 
                 {hasCompletedTutorial && (
                    <button onClick={() => startGame(true)} className="mt-4 text-xs text-slate-500 hover:text-slate-300 underline">
                        重玩教程
                    </button>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Overlay - REIMAGINED */}
      {gameState === 'TUTORIAL' && tutorialStep && (
          <div className="absolute inset-x-0 bottom-12 z-40 flex justify-center px-4 pointer-events-none">
              <div 
                className={`
                  relative max-w-4xl w-full bg-[#0a101f]/95 backdrop-blur-xl 
                  border border-slate-600/50 shadow-[0_0_40px_rgba(0,0,0,0.6)] 
                  pointer-events-auto transition-all duration-300
                  ${tutorialStep.requiredAction === 'NEXT' ? 'cursor-pointer hover:bg-[#0f1729]' : ''}
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
                               Step {String(tutorialStep.id + 1).padStart(2, '0')}
                             </span>
                             <h3 className="text-slate-400 font-mono-lab text-xs uppercase tracking-[0.2em]">
                               战术指导协议 // Alpha
                             </h3>
                          </div>
                          
                          <p className="text-lg md:text-xl text-slate-100 font-sans font-medium leading-relaxed tracking-wide drop-shadow-sm min-h-[3.5rem]">
                              <RichTypewriter text={tutorialStep.text} />
                          </p>

                          {/* Action Prompt */}
                          {tutorialStep.requiredAction === 'NEXT' && (
                              <div className="mt-4 flex items-center gap-2 text-xs text-yellow-400 font-mono animate-bounce opacity-80">
                                  <ChevronRight size={14} />
                                  <span className="tracking-widest uppercase border-b border-dashed border-yellow-500/50 pb-0.5">点击任意处继续</span>
                              </div>
                          )}
                          {tutorialStep.requiredAction !== 'NEXT' && (
                              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 font-mono">
                                  <Activity size={12} className="text-blue-400" />
                                  <span className="tracking-widest uppercase">等待指令执行...</span>
                              </div>
                          )}
                      </div>

                      {/* Right: Controls */}
                      <div className="flex flex-col justify-between items-end pl-4 border-l border-slate-700/50">
                          <button 
                            onClick={(e) => { e.stopPropagation(); resetGame(); }}
                            className="text-slate-600 hover:text-red-400 transition-colors p-2 rounded-full hover:bg-slate-800"
                            title="Abort Tutorial"
                          >
                             <X size={16} />
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
                            ${idx <= tutorialStep.id ? 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]' : 'bg-slate-800'}
                          `}
                        />
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Game Over Screen */}
      {(gameState === 'VICTORY' || gameState === 'DEFEAT') && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
           <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-700 rounded-lg text-center shadow-2xl relative overflow-hidden">
             
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-full w-full animate-[scan_2s_linear_infinite] pointer-events-none"></div>

             {gameState === 'VICTORY' ? (
               <Award size={80} className="mx-auto mb-6 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
             ) : (
               <Skull size={80} className="mx-auto mb-6 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
             )}
             
             <h2 className={`text-5xl font-black mb-2 uppercase tracking-tighter ${gameState === 'VICTORY' ? 'text-yellow-500' : 'text-red-500'}`}>
               {gameState === 'VICTORY' ? '主宰' : '灭绝'}
             </h2>
             
             <div className="h-px w-full bg-slate-800 my-6"></div>

             <p className="text-slate-400 mb-2 font-mono-lab text-sm">
               {gameState === 'VICTORY' 
                 ? "受试毒株已达到100%饱和度。实验结束。" 
                 : "受试毒株未能在与本地攻击性群落的竞争中存活。"}
             </p>
             <p className="text-slate-500 mb-8 font-mono-lab text-xs">
                {difficulty ? `难度: ${DIFFICULTY_SETTINGS[difficulty].name}` : 'TUTORIAL'}
             </p>

             <button
              onClick={resetGame}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 rounded text-slate-200 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              返回菜单
            </button>
           </div>
        </div>
      )}

      {/* Main Game Area */}
      <div className="flex-1 relative z-0">
         {(world.nodes.length > 0) && (
           <GameMap 
             world={world} 
             playerColor={playerColor} 
             onAttack={handleAttack}
             nextCurrentTime={nextCurrentTime}
             isAutoPilot={isPlayerAutoPilot}
             onToggleAutoPilot={toggleAutoPilot}
             tutorialTargetId={gameState === 'TUTORIAL' ? tutorialStep?.targetNodeId : undefined}
             onTutorialClick={nextTutorialStep}
           />
         )}
      </div>

    </div>
  );
};

export default App;
