
import React from 'react';
import { Activity, Cpu, Globe } from 'lucide-react';
import { PlayerColor, DifficultyLevel } from '../../types';
import { COLOR_MAP, PLAYABLE_COLORS, DIFFICULTY_SETTINGS } from '../../constants';
import MicrobioLogo from '../ui/MicrobioLogo';

interface MainMenuProps {
  playerColor: PlayerColor;
  setPlayerColor: (color: PlayerColor) => void;
  difficulty: DifficultyLevel;
  setDifficulty: (level: DifficultyLevel) => void;
  startGame: (forceTutorial?: boolean) => void;
  hasCompletedTutorial: boolean;
}

const MainMenu: React.FC<MainMenuProps> = ({
  playerColor,
  setPlayerColor,
  difficulty,
  setDifficulty,
  startGame,
  hasCompletedTutorial
}) => {
  return (
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
  );
};

export default MainMenu;
