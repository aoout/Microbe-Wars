
import React, { useState, useEffect, useMemo } from 'react';
import { RotateCcw, Award, Skull, Activity, Globe, Cpu, GraduationCap, ChevronRight, X, Radio, SkipForward, Dna } from 'lucide-react';
import { useGameEngine } from './hooks/useGameEngine';
import GameMap from './components/GameMap';
import StatsWidget from './components/StatsWidget'; // Import the new component
import { COLOR_MAP, PLAYABLE_COLORS, DIFFICULTY_SETTINGS } from './constants';
import { DifficultyLevel } from './types';

// Custom Animated Logo Component
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
    togglePause,
    skipTutorial,
    tutorialStep,
    nextTutorialStep,
    hasCompletedTutorial
  } = useGameEngine();

  // Calculate stats when game is over
  const gameStats = useMemo(() => {
    if (gameState !== 'VICTORY' && gameState !== 'DEFEAT') return null;
    
    // We can assume world has nodes. If world is empty (unlikely), handle gracefully.
    const totalNodes = world.nodes.length || 1; 
    const playerNodes = world.nodes.filter(n => n.owner === playerColor);
    const dominance = (playerNodes.length / totalNodes) * 100;
    
    const nodeUnits = playerNodes.reduce((acc, n) => acc + n.count, 0);
    const payloadUnits = world.payloads.filter(p => p.owner === playerColor).reduce((acc, p) => acc + p.count, 0);
    
    return {
      dominance: Math.round(dominance),
      biomass: Math.floor(nodeUnits + payloadUnits),
      simId: `SIM-${Math.floor(Math.random()*9000)+1000}-${String.fromCharCode(65+Math.random()*26)}${String.fromCharCode(65+Math.random()*26)}`
    };
  }, [gameState, world, playerColor]);

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
                    <MicrobioLogo size={64} />
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
                    {/* Unified Start Button */}
                    <button
                      onClick={() => startGame(!hasCompletedTutorial)}
                      className={`
                        flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] border border-blue-400/50 flex items-center justify-center gap-3 group-hover:gap-4
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
                            ${idx <= tutorialStep.id ? 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]' : 'bg-slate-800'}
                          `}
                        />
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Game Over Screen - Enhanced */}
      {(gameState === 'VICTORY' || gameState === 'DEFEAT') && gameStats && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
           {/* Rotating Glow Background */}
           <div className={`absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-20 animate-[spin_10s_linear_infinite] ${gameState === 'VICTORY' ? 'bg-gradient-to-tr from-yellow-500 to-amber-300' : 'bg-gradient-to-tr from-red-600 to-rose-900'}`}></div>

           <div className="relative max-w-lg w-full bg-[#0f172a]/95 border border-slate-700/50 shadow-2xl overflow-hidden group">
             {/* Top Decorative Line */}
             <div className={`h-1 w-full ${gameState === 'VICTORY' ? 'bg-yellow-500' : 'bg-red-600'} shadow-[0_0_15px_currentColor]`}></div>
             
             {/* Tech Corners */}
             <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/20"></div>
             <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/20"></div>
             
             <div className="p-8 relative z-10">
               {/* Header Section */}
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                     <div className={`p-3 rounded-lg border ${gameState === 'VICTORY' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        {gameState === 'VICTORY' ? (
                           <Award className="text-yellow-500 w-8 h-8" />
                        ) : (
                           <Skull className="text-red-500 w-8 h-8" />
                        )}
                     </div>
                     <div>
                        <h2 className={`text-3xl font-black uppercase tracking-widest ${gameState === 'VICTORY' ? 'text-yellow-500' : 'text-red-500'} drop-shadow-md`}>
                           {gameState === 'VICTORY' ? '实验成功' : '收容失效'}
                        </h2>
                        <p className="text-[10px] text-slate-500 font-mono tracking-[0.2em] uppercase">
                           ID: {gameStats.simId} // {new Date().toLocaleTimeString()}
                        </p>
                     </div>
                  </div>
               </div>

               {/* Stats Grid */}
               <div className="grid grid-cols-2 gap-4 mb-8">
                  {/* Dominance */}
                  <div className="bg-slate-900/50 p-4 rounded border border-slate-800 flex flex-col gap-1">
                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                        <Activity size={10} /> 菌株占有率
                     </span>
                     <div className="flex items-end gap-2">
                        <span className="text-2xl font-mono text-slate-200">{gameStats.dominance}%</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full mb-1.5 overflow-hidden">
                           <div className={`h-full rounded-full ${gameState === 'VICTORY' ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${gameStats.dominance}%` }}></div>
                        </div>
                     </div>
                  </div>

                  {/* Biomass */}
                  <div className="bg-slate-900/50 p-4 rounded border border-slate-800 flex flex-col gap-1">
                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                        <Dna size={10} /> 总生物质
                     </span>
                     <span className="text-2xl font-mono text-slate-200">{gameStats.biomass.toLocaleString()}</span>
                  </div>

                  {/* Difficulty */}
                  <div className="bg-slate-900/50 p-4 rounded border border-slate-800 flex flex-col gap-1 col-span-2">
                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                        <Cpu size={10} /> 环境难度
                     </span>
                     <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-300">
                           {difficulty ? DIFFICULTY_SETTINGS[difficulty].name : 'TUTORIAL PROTOCOL'}
                        </span>
                        <div className="flex gap-1">
                           {[1,2,3,4,5,6].map(i => (
                              <div key={i} className={`w-1.5 h-3 rounded-sm ${difficulty >= i ? (gameState === 'VICTORY' ? 'bg-yellow-500' : 'bg-red-500') : 'bg-slate-800'}`}></div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>

               {/* Assessment Log */}
               <div className="mb-8 border-l-2 border-slate-700 pl-4 py-1">
                  <h4 className="text-xs text-slate-400 uppercase tracking-widest mb-1">Assessment Log</h4>
                  <p className="text-sm text-slate-300 font-mono leading-relaxed opacity-90">
                     {gameState === 'VICTORY' 
                        ? "受试样本表现出极高的适应性与侵略性。已成功占据培养皿主导地位。建议立即保存样本数据并提升至下一阶段测试。" 
                        : "受试样本未能在大规模冲突中存活。外部菌株表现出压倒性优势。建议销毁当前批次并重新校准生长参数。"}
                  </p>
               </div>

               {/* Action Button */}
               <button
                  onClick={resetGame}
                  className={`
                     w-full group relative overflow-hidden py-4 rounded font-bold uppercase tracking-[0.2em] transition-all
                     ${gameState === 'VICTORY' 
                        ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_0_20px_rgba(234,179,8,0.4)]' 
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]'}
                  `}
               >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                  <span className="relative flex items-center justify-center gap-2">
                     <RotateCcw size={18} /> 重启模拟
                  </span>
               </button>
             </div>
           </div>
        </div>
      )}

      {/* Main Game Area */}
      <div className="flex-1 relative z-0">
         {(world.nodes.length > 0) && (
           <>
             <GameMap 
               world={world} 
               playerColor={playerColor} 
               onAttack={handleAttack}
               nextCurrentTime={nextCurrentTime}
               isAutoPilot={isPlayerAutoPilot}
               onToggleAutoPilot={toggleAutoPilot}
               togglePause={togglePause}
               isPaused={gameState === 'PAUSED'}
               onTogglePause={togglePause}
               tutorialTargetId={gameState === 'TUTORIAL' ? tutorialStep?.targetNodeId : undefined}
               onTutorialClick={nextTutorialStep}
             />
             
             {/* New Stats Widget */}
             {(gameState === 'PLAYING' || gameState === 'TUTORIAL') && (
                <StatsWidget world={world} />
             )}
           </>
         )}
      </div>

    </div>
  );
};

export default App;
