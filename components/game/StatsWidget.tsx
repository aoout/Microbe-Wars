
import React, { useMemo, useState } from 'react';
import { GameWorld, PlayerColor } from '../../types';
import { COLOR_MAP, PLAYABLE_COLORS } from '../../constants';
import { PieChart, BarChart3 } from 'lucide-react';

interface StatsWidgetProps {
  world: GameWorld;
}

type StatMode = 'NODES' | 'UNITS';

const StatsWidget: React.FC<StatsWidgetProps> = ({ world }) => {
  const [mode, setMode] = useState<StatMode>('NODES');

  const stats = useMemo(() => {
    // Fixed Order: Playable colors first, then Neutral
    const fixedOrder = [...PLAYABLE_COLORS, PlayerColor.GRAY];
    
    // Calculate raw numbers
    const data = fixedOrder.map(color => {
      // Node Count
      const nodes = world.nodes.filter(n => n.owner === color);
      const nodeCount = nodes.length;
      
      // Unit Count (Nodes + Payload)
      const nodeUnits = nodes.reduce((sum, n) => sum + n.count, 0);
      const payloadUnits = world.payloads
        .filter(p => p.owner === color)
        .reduce((sum, p) => sum + p.count, 0);
      const totalUnits = Math.floor(nodeUnits + payloadUnits);

      return {
        color,
        nodeCount,
        totalUnits
      };
    });

    // Calculate totals
    const totalNodes = world.nodes.length || 1;
    const totalBiomass = data.reduce((sum, d) => sum + d.totalUnits, 0) || 1;
    const currentTotal = mode === 'NODES' ? totalNodes : totalBiomass;

    // Format for display
    const formatted = data.map(d => {
      const value = mode === 'NODES' ? d.nodeCount : d.totalUnits;
      const percentage = (value / currentTotal) * 100;
      
      let label = "";
      if (d.color === PlayerColor.GRAY) label = "Neutral";
      else label = d.color;

      return {
        ...d,
        label,
        value,
        percentage
      };
    });
    // Removed .sort() to maintain fixed order

    return { items: formatted, total: currentTotal };
  }, [world, mode]);

  const toggleMode = () => {
    setMode(prev => prev === 'NODES' ? 'UNITS' : 'NODES');
  };

  return (
    <div 
        onClick={toggleMode}
        className="absolute bottom-8 left-8 z-40 bg-[#050b14]/60 backdrop-blur-md border border-slate-700/30 rounded-full animate-in fade-in slide-in-from-left-4 duration-700 cursor-pointer hover:bg-[#050b14]/80 hover:border-slate-600 transition-all group select-none pr-4 pl-3 py-2 flex items-center gap-4 shadow-sm hover:shadow-lg"
        title="Click to switch view"
    >
      
      {/* Icon / Label Area */}
      <div className="flex items-center gap-2 text-slate-500 group-hover:text-slate-300 transition-colors border-r border-slate-800/50 pr-4 min-w-[90px]">
         {mode === 'NODES' ? <PieChart size={14} className="text-slate-400" /> : <BarChart3 size={14} className="text-slate-400" />}
         <div className="flex flex-col leading-none">
            <span className="text-[8px] font-bold tracking-[0.2em] uppercase font-mono-lab text-slate-600 mb-0.5">
                {mode === 'NODES' ? 'CONTROL' : 'BIOMASS'}
            </span>
            <span className="text-xs font-mono font-bold tracking-tight text-slate-300">
                {stats.total.toLocaleString()}
            </span>
         </div>
      </div>

      {/* THE STACKED BAR (Fixed Order, No Text, Elegant) */}
      <div className="h-2 w-36 sm:w-48 flex rounded-full overflow-hidden bg-slate-900/50 border border-slate-800/50 relative">
        {stats.items.map((item) => (
            <div 
                key={item.color}
                className="h-full transition-all duration-700 ease-in-out border-r border-[#050b14]/20 last:border-0 hover:brightness-110"
                style={{ 
                  width: `${item.percentage}%`,
                  backgroundColor: COLOR_MAP[item.color],
                  opacity: item.value > 0 ? 0.9 : 0 // Fade out empty factions seamlessly
                }}
                title={`${item.label}: ${item.value.toLocaleString()} (${Math.round(item.percentage)}%)`}
            />
        ))}
      </div>
      
    </div>
  );
};

export default StatsWidget;
