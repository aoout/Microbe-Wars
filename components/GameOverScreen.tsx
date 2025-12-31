
import React, { useMemo } from 'react';
import { RotateCcw, Award, Skull, Activity, Dna, Cpu } from 'lucide-react';
import { GameWorld, PlayerColor, GameState, DifficultyLevel } from '../types';
import { DIFFICULTY_SETTINGS } from '../constants';

interface GameOverScreenProps {
  gameState: GameState;
  world: GameWorld;
  playerColor: PlayerColor;
  difficulty: DifficultyLevel;
  resetGame: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({
  gameState,
  world,
  playerColor,
  difficulty,
  resetGame
}) => {
  // Calculate stats
  const gameStats = useMemo(() => {
    if (gameState !== 'VICTORY' && gameState !== 'DEFEAT') return null;
    
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

  if (!gameStats) return null;

  return (
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
  );
};

export default GameOverScreen;
