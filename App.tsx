import React from 'react';
import { RotateCcw, Award, Skull, Dna, Activity, Globe } from 'lucide-react';
import { useGameEngine } from './hooks/useGameEngine';
import GameMap from './components/GameMap';
import { COLOR_MAP, PLAYABLE_COLORS } from './constants';

const App: React.FC = () => {
  const {
    gameState,
    world,
    playerColor,
    setPlayerColor,
    winner,
    nextCurrentTime,
    startGame,
    resetGame,
    handleAttack
  } = useGameEngine();

  return (
    <div className="w-full h-screen flex flex-col font-sans overflow-hidden relative selection:bg-blue-500/30">
      
      {/* Menu Screen - Laboratory Hologram Theme */}
      {gameState === 'MENU' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="max-w-xl w-full p-1 bg-slate-900/60 backdrop-blur-xl rounded-xl border border-slate-700 shadow-2xl relative group">
            
            {/* Holographic Border Effects */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-30 blur group-hover:opacity-50 transition duration-1000"></div>
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400 rounded-tl-xl"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400 rounded-br-xl"></div>

            <div className="relative bg-[#050b14] p-10 rounded-xl overflow-hidden">
               {/* Background Grid inside Card */}
               <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

               <div className="flex flex-col items-center relative z-10">
                 <div className="mb-6 p-4 rounded-full border border-blue-500/30 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <Dna size={48} className="text-blue-400 animate-pulse" />
                 </div>

                 <h1 className="text-6xl font-black mb-2 tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-blue-400 to-purple-400 uppercase drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                    Microbe
                 </h1>
                 <h2 className="text-2xl font-light tracking-[0.5em] text-slate-400 mb-10 border-b border-slate-800 pb-2">
                    WARFARE
                 </h2>

                 <div className="w-full bg-slate-900/50 p-6 rounded-lg border border-slate-800 mb-8">
                   <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                     <Activity size={12}/> Select Genetic Strain
                   </label>
                   <div className="flex justify-center gap-6">
                     {PLAYABLE_COLORS.map(c => (
                       <button
                         key={c}
                         onClick={() => setPlayerColor(c)}
                         className={`
                             w-12 h-12 rounded-full border-2 transition-all duration-300 relative group
                             ${playerColor === c 
                               ? 'border-white scale-110 shadow-[0_0_20px_currentColor]' 
                               : 'border-slate-700 opacity-50 hover:opacity-100 hover:scale-110 hover:border-slate-500'}
                         `}
                         style={{ color: COLOR_MAP[c], backgroundColor: playerColor === c ? COLOR_MAP[c] : 'transparent' }}
                       >
                           {/* Hollow center for unselected, filled for selected */}
                           <div className={`absolute inset-2 rounded-full ${playerColor === c ? 'bg-white/30' : 'bg-current opacity-20'}`}></div>
                       </button>
                     ))}
                   </div>
                 </div>

                 <button
                   onClick={startGame}
                   className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] border border-blue-400/50 flex items-center justify-center gap-3 group-hover:gap-4"
                 >
                   <Globe size={20} className="animate-spin-slow" />
                   Initiate Sequence
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {(gameState === 'VICTORY' || gameState === 'DEFEAT') && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
           <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-700 rounded-lg text-center shadow-2xl relative overflow-hidden">
             
             {/* Scan line effect inside modal */}
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-full w-full animate-[scan_2s_linear_infinite] pointer-events-none"></div>

             {gameState === 'VICTORY' ? (
               <Award size={80} className="mx-auto mb-6 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
             ) : (
               <Skull size={80} className="mx-auto mb-6 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
             )}
             
             <h2 className={`text-5xl font-black mb-2 uppercase tracking-tighter ${gameState === 'VICTORY' ? 'text-yellow-500' : 'text-red-500'}`}>
               {gameState === 'VICTORY' ? 'Dominant' : 'Extinct'}
             </h2>
             
             <div className="h-px w-full bg-slate-800 my-6"></div>

             <p className="text-slate-400 mb-8 font-mono-lab text-sm">
               {gameState === 'VICTORY' 
                 ? "Subject strain has achieved 100% saturation. Experiment concluded." 
                 : "Subject strain failed to compete with local aggressive fauna."}
             </p>

             <button
              onClick={resetGame}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 rounded text-slate-200 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              Reset Simulation
            </button>
           </div>
        </div>
      )}

      {/* Main Game Area */}
      <div className="flex-1 relative z-0">
         {world.nodes.length > 0 && (
           <GameMap 
             world={world} 
             playerColor={playerColor} 
             onAttack={handleAttack}
             nextCurrentTime={nextCurrentTime}
           />
         )}
      </div>

    </div>
  );
};

export default App;