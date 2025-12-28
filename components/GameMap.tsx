
import React, { useRef, useState, useEffect, memo } from 'react';
import { GameWorld, Node, Edge } from '../types';
import { COLOR_MAP, GAME_HEIGHT, GAME_WIDTH, NODE_RADIUS_BASE } from '../constants';
import { Activity, Bot, Crosshair, Pause, Play } from 'lucide-react';

// --- Sub-components ---

// 1. Edges Layer: Memoized SVG Layer
interface EdgesLayerProps {
  edges: Edge[];
  nodes: Node[];
  selectedNodeId: string | null;
}

const EdgesLayer = memo(({ edges, nodes, selectedNodeId }: EdgesLayerProps) => {
  return (
    <g className="pointer-events-none">
      {edges.map((edge, i) => {
        const s = nodes.find(n => n.id === edge.source)!;
        const t = nodes.find(n => n.id === edge.target)!;
        const isRandom = edge.type === 'RANDOM';
        const isSelected = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);

        let strokeColor = "#475569";
        let strokeWidth = 1;
        let opacity = 0.4; 
        let dashArray = "none";
        
        if (isRandom) {
          strokeColor = isSelected ? "#fcd34d" : "#d97706";
          strokeWidth = isSelected ? 3 : 2; 
          opacity = isSelected ? 1 : 0.6; 
          dashArray = "6, 4";
        } else {
          strokeColor = isSelected ? "#38bdf8" : "#475569";
          strokeWidth = isSelected ? 5 : 3;
          opacity = isSelected ? 1 : 0.6;
          dashArray = "none";
        }

        return (
          <g key={`${edge.source}-${edge.target}-${i}`}>
            {isSelected && (
              <line 
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={isRandom ? "#f59e0b" : "#0ea5e9"}
                strokeWidth={strokeWidth + 4}
                opacity={0.1}
                strokeLinecap="round"
              />
            )}
            <line 
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              opacity={opacity}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </g>
        );
      })}
    </g>
  );
}, (prev, next) => {
  return prev.edges === next.edges && prev.selectedNodeId === next.selectedNodeId;
});

// --- Main Component ---

interface GameMapProps {
  world: GameWorld;
  playerColor: string;
  onAttack: (fromId: string, toId: string, isContinuous: boolean) => void;
  nextCurrentTime: number; 
  isAutoPilot: boolean;
  onToggleAutoPilot: () => void;
  isPaused: boolean; 
  onTogglePause: () => void;
  tutorialTargetId?: string; 
  onTutorialClick?: () => void; 
}

const GameMap: React.FC<GameMapProps> = ({ 
  world, 
  playerColor, 
  onAttack, 
  nextCurrentTime, 
  isAutoPilot, 
  onToggleAutoPilot,
  isPaused,
  onTogglePause,
  tutorialTargetId,
  onTutorialClick
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  
  // Drag State
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<{x: number, y: number} | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const latestWorldRef = useRef(world);

  useEffect(() => {
    latestWorldRef.current = world;
  }, [world]);

  // --- Timer Logic ---
  useEffect(() => {
    const interval = setInterval(() => {
      // If paused, don't update countdown to avoid confusion
      if (isPaused) return;

      const now = Date.now();
      const diff = Math.max(0, Math.ceil((nextCurrentTime - now) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [nextCurrentTime, isPaused]);

  // --- Canvas Rendering Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true }); 
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      const payloads = latestWorldRef.current.payloads;
      
      for (let i = 0; i < payloads.length; i++) {
        const p = payloads[i];
        const cx = p.startX + (p.endX - p.startX) * p.progress;
        const cy = p.startY + (p.endY - p.startY) * p.progress;
        const color = COLOR_MAP[p.owner];

        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // --- Helpers ---

  const getCursorPoint = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const getDynamicRadius = (count: number) => {
    return NODE_RADIUS_BASE * (1 + 0.072 * Math.sqrt(count));
  };

  // --- Interaction Handlers ---

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    if (dragSourceId) {
        setDragEnd(getCursorPoint(e));
    }
  };

  const handleSvgMouseUp = () => {
    if (dragSourceId) {
        setDragSourceId(null);
        setDragEnd(null);
    }
  };

  const handleBgClick = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setSelectedNodeId(null);
    }
  };

  const handleNodeMouseDown = (node: Node, e: React.MouseEvent) => {
    if (e.button !== 0 || node.owner !== playerColor) return;
    setDragSourceId(node.id);
    setDragEnd({ x: node.x, y: node.y });
    
    // Tutorial: If asking to select player node
    if (onTutorialClick && tutorialTargetId === node.id) {
       onTutorialClick();
    }
  };

  const handleNodeMouseUp = (node: Node, e: React.MouseEvent) => {
    if (dragSourceId && dragSourceId !== node.id) {
        e.stopPropagation(); 
        
        const isConnected = world.edges.some(edge => 
           (edge.source === dragSourceId && edge.target === node.id) || 
           (edge.source === node.id && edge.target === dragSourceId)
        );

        if (isConnected) {
             const isContinuous = e.ctrlKey || e.metaKey;
             onAttack(dragSourceId, node.id, isContinuous);
             setSelectedNodeId(null);
        }
        setDragSourceId(null);
        setDragEnd(null);
    }
  };

  const handleNodeClick = (node: Node, e: React.MouseEvent) => {
    if (!selectedNodeId) {
      if (node.owner === playerColor) {
        setSelectedNodeId(node.id);
        if (onTutorialClick && tutorialTargetId === node.id) {
             onTutorialClick();
        }
      }
      return;
    }

    if (selectedNodeId) {
      if (node.id === selectedNodeId) {
        setSelectedNodeId(null);
        return;
      }

      const isConnected = world.edges.some(edge => 
        (edge.source === selectedNodeId && edge.target === node.id) ||
        (edge.source === node.id && edge.target === selectedNodeId)
      );

      if (isConnected) {
        const isContinuous = e.ctrlKey || e.metaKey;
        onAttack(selectedNodeId, node.id, isContinuous);
        setSelectedNodeId(null); 
      } else {
        if (node.owner === playerColor) {
          setSelectedNodeId(node.id);
        } else {
          setSelectedNodeId(null); 
        }
      }
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden select-none z-10">
      
      {/* 1. Canvas Layer */}
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="absolute top-0 left-0 w-full h-full max-w-screen-xl max-h-screen object-contain z-20 pointer-events-none"
      />

      {/* 2. SVG Layer */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${GAME_WIDTH} ${GAME_HEIGHT}`}
        className="w-full h-full max-w-screen-xl max-h-screen object-contain drop-shadow-2xl z-10"
        onClick={handleBgClick}
        onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp}
        onMouseDown={() => {}} 
      >
        <defs>
          <pattern id="organic-grid" width="100" height="100" patternUnits="userSpaceOnUse">
             <circle cx="20" cy="20" r="1.5" fill="#334155" opacity="0.3" />
             <circle cx="70" cy="60" r="1" fill="#334155" opacity="0.2" />
          </pattern>
          
          {Object.entries(COLOR_MAP).map(([colorKey, hexValue]) => (
            <radialGradient id={`grad-cell-${colorKey}`} key={colorKey} cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" /> 
              <stop offset="30%" stopColor={hexValue} stopOpacity="0.6" />
              <stop offset="90%" stopColor={hexValue} stopOpacity="0.1" />
              <stop offset="100%" stopColor={hexValue} stopOpacity="0.8" />
            </radialGradient>
          ))}
          
          {Object.entries(COLOR_MAP).map(([colorKey, hexValue]) => (
            <radialGradient id={`grad-core-${colorKey}`} key={`core-${colorKey}`} cx="50%" cy="50%" r="50%">
               <stop offset="0%" stopColor="white" stopOpacity="0.9" />
               <stop offset="100%" stopColor={hexValue} stopOpacity="0.8" />
            </radialGradient>
          ))}
        </defs>

        <rect width="100%" height="100%" fill="url(#organic-grid)" />

        <EdgesLayer 
          edges={world.edges} 
          nodes={world.nodes} 
          selectedNodeId={selectedNodeId} 
        />

        {dragSourceId && dragEnd && (
            <line
                x1={world.nodes.find(n => n.id === dragSourceId)?.x}
                y1={world.nodes.find(n => n.id === dragSourceId)?.y}
                x2={dragEnd.x}
                y2={dragEnd.y}
                stroke={COLOR_MAP[playerColor as keyof typeof COLOR_MAP] || '#fff'}
                strokeWidth="3"
                strokeDasharray="8 6"
                strokeLinecap="round"
                opacity="0.8"
                className="pointer-events-none"
            />
        )}

        <g>
          {world.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isHover = hoverNodeId === node.id;
            const isDraggingSource = dragSourceId === node.id;
            const isTutorialTarget = tutorialTargetId === node.id;
            
            const currentRadius = getDynamicRadius(node.count);
            const color = COLOR_MAP[node.owner];
            
            let isTargetable = false;
            const sourceIdToCheck = dragSourceId || selectedNodeId;
            if (sourceIdToCheck && sourceIdToCheck !== node.id) {
               isTargetable = world.edges.some(e => 
                (e.source === sourceIdToCheck && e.target === node.id) ||
                (e.source === node.id && e.target === sourceIdToCheck)
              );
            }

            return (
              <g
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(node, e)}
                onMouseUp={(e) => handleNodeMouseUp(node, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClick(node, e);
                }}
                onMouseEnter={() => setHoverNodeId(node.id)}
                onMouseLeave={() => setHoverNodeId(null)}
                className="cursor-pointer transition-transform duration-200"
                style={{ 
                  transformOrigin: `${node.x}px ${node.y}px`,
                  transform: (isHover || isDraggingSource) ? 'scale(1.08)' : 'scale(1)'
                }}
              >
                {/* Advanced Tutorial Reticle */}
                {isTutorialTarget && (
                  <g className="pointer-events-none">
                     {/* Rotating Dashed Ring */}
                     <circle
                       cx={node.x} cy={node.y}
                       r={currentRadius + 18}
                       fill="none"
                       stroke="#facc15"
                       strokeWidth="1.5"
                       strokeDasharray="10 6"
                       className="animate-[spin_6s_linear_infinite]"
                       style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                       opacity="0.6"
                     />
                     {/* Pulsing Solid Ring */}
                     <circle
                       cx={node.x} cy={node.y}
                       r={currentRadius + 12}
                       fill="none"
                       stroke="#facc15"
                       strokeWidth="2"
                       className="animate-pulse-membrane"
                     />
                     {/* Corner Brackets */}
                     <g className="animate-[spin_4s_linear_reverse_infinite]" style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
                       {/* Top Left */}
                       <path d={`M ${node.x - currentRadius - 12} ${node.y - currentRadius} V ${node.y - currentRadius - 12} H ${node.x - currentRadius}`} stroke="#facc15" strokeWidth="2" fill="none" />
                       {/* Bottom Right */}
                       <path d={`M ${node.x + currentRadius + 12} ${node.y + currentRadius} V ${node.y + currentRadius + 12} H ${node.x + currentRadius}`} stroke="#facc15" strokeWidth="2" fill="none" />
                     </g>
                  </g>
                )}

                {/* Selection Ring */}
                {(isSelected || isDraggingSource || (isTargetable && isHover)) && (
                   <circle
                     cx={node.x} cy={node.y}
                     r={currentRadius + 6}
                     fill="none"
                     stroke={isSelected || isDraggingSource ? '#fff' : color}
                     strokeWidth={1}
                     strokeOpacity={0.5}
                     strokeDasharray="4 2"
                   />
                )}

                {/* Main Body */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={currentRadius}
                  fill={node.owner === 'GRAY' ? '#1e293b' : color}
                  fillOpacity={node.owner === 'GRAY' ? 0.5 : 0.2}
                  stroke={node.owner === 'GRAY' ? '#475569' : color}
                  strokeWidth={isSelected || isDraggingSource ? 2 : 1.5}
                  strokeOpacity={0.8}
                />
                
                {/* Gradient Overlay */}
                <circle
                  cx={node.x} cy={node.y}
                  r={currentRadius * 0.9}
                  fill={`url(#grad-cell-${node.owner})`}
                />

                {/* Inner Core */}
                <circle
                  cx={node.x} cy={node.y}
                  r={currentRadius * 0.35}
                  fill={`url(#grad-core-${node.owner})`}
                  opacity={0.9}
                />

                {/* Text Count */}
                <text
                  x={node.x}
                  y={node.y}
                  dy=".35em"
                  textAnchor="middle"
                  className="font-mono-lab font-bold fill-white text-[10px] pointer-events-none drop-shadow-md"
                  style={{ 
                    fontSize: Math.max(10, currentRadius * 0.55),
                  }}
                >
                  {Math.floor(node.count)}
                </text>
                
                {/* Capacity Ring */}
                <circle 
                  cx={node.x} cy={node.y} r={currentRadius - 2}
                  fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.2"
                  strokeDasharray={`${(node.count / node.capacity) * (2 * Math.PI * (currentRadius-2))} 1000`}
                  transform={`rotate(-90 ${node.x} ${node.y})`}
                />
              </g>
            );
          })}
        </g>
         
      </svg>
      
      {/* HUD - Timer */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none opacity-80">
         <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-sm px-4 py-1.5 rounded-full border border-slate-700/30">
           <Activity className={`w-3 h-3 ${timeLeft < 10 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} />
           <span className="font-mono-lab text-xs text-slate-300 font-medium tracking-wide">
             周期: {timeLeft.toString().padStart(2, '0')}s
           </span>
         </div>
      </div>

      {/* HUD - Control Panel (Combined Pause & Auto Pilot) */}
      {/* UPDATED: Increased z-index to 50 so it sits above the Pause Overlay if needed, though clicking overlay now resumes too */}
      {!tutorialTargetId && (
        <div className="absolute top-4 right-4 z-50 opacity-90 flex items-center gap-2">
           {/* Pause Button */}
           <button
             onClick={onTogglePause}
             className={`
               w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-300 pointer-events-auto
               ${isPaused 
                 ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-pulse' 
                 : 'bg-slate-900/40 border-slate-700/30 text-slate-400 hover:bg-slate-800 hover:text-white hover:border-slate-500'}
             `}
             title={isPaused ? "Resume Game" : "Pause Game"}
           >
              {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
           </button>

           {/* Auto Pilot Toggle */}
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

      {/* PAUSE OVERLAY */}
      {/* UPDATED: Added cursor-pointer and onClick handler to allow resuming by clicking the screen */}
      {isPaused && (
        <div 
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer"
          onClick={onTogglePause}
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
      )}

    </div>
  );
};

export default GameMap;
