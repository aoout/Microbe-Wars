import React, { useRef, useState, useEffect, memo } from 'react';
import { GameWorld, Node, Edge } from '../types';
import { COLOR_MAP, GAME_HEIGHT, GAME_WIDTH, NODE_RADIUS_BASE } from '../constants';
import { Activity } from 'lucide-react';

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
        let opacity = 0.4; // Reduced base opacity
        let dashArray = "none";
        
        // Removed heavy neon-line filter from default edges
        
        if (isRandom) {
          strokeColor = isSelected ? "#fcd34d" : "#d97706";
          strokeWidth = isSelected ? 2 : 1.5;
          opacity = isSelected ? 1 : 0.4;
          dashArray = "6, 4";
        } else {
          strokeColor = isSelected ? "#38bdf8" : "#334155";
          strokeWidth = isSelected ? 4 : 2;
          opacity = isSelected ? 1 : 0.4;
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
}

const GameMap: React.FC<GameMapProps> = ({ world, playerColor, onAttack, nextCurrentTime }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  
  // Drag State
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<{x: number, y: number} | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Ref to hold world data for the animation loop without triggering effects
  const latestWorldRef = useRef(world);

  // Update ref when prop changes
  useEffect(() => {
    latestWorldRef.current = world;
  }, [world]);

  // --- Timer Logic ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((nextCurrentTime - now) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [nextCurrentTime]);

  // --- Canvas Rendering Loop (Optimized) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true }); // optimize for transparency
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Always clear, but maybe optimize area if needed (full clear is usually fastest for many moving objects)
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      const payloads = latestWorldRef.current.payloads;
      
      // Batch rendering by setting styles once if possible, 
      // but here colors change per payload, so we iterate.
      // Use simple drawing operations.
      
      for (let i = 0; i < payloads.length; i++) {
        const p = payloads[i];
        const cx = p.startX + (p.endX - p.startX) * p.progress;
        const cy = p.startY + (p.endY - p.startY) * p.progress;
        const color = COLOR_MAP[p.owner];

        // 1. Draw Core (One fill)
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // 2. Draw White Center (Highlight) - Small detail, cheap
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, []); // Run once on mount, loop reads from ref

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
    return NODE_RADIUS_BASE * (1 + 0.12 * Math.sqrt(count));
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
      
      {/* 1. Canvas Layer: High Frequency Particles */}
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="absolute top-0 left-0 w-full h-full max-w-screen-xl max-h-screen object-contain z-20 pointer-events-none"
      />

      {/* 2. SVG Layer: Low Frequency/Static Elements + Interaction */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${GAME_WIDTH} ${GAME_HEIGHT}`}
        className="w-full h-full max-w-screen-xl max-h-screen object-contain drop-shadow-2xl z-10"
        onClick={handleBgClick}
        onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp}
        onMouseDown={() => {}} // Empty handler to clear implicit default
      >
        <defs>
          <pattern id="organic-grid" width="100" height="100" patternUnits="userSpaceOnUse">
             <circle cx="20" cy="20" r="1.5" fill="#334155" opacity="0.3" />
             <circle cx="70" cy="60" r="1" fill="#334155" opacity="0.2" />
          </pattern>
          
          {/* REMOVED: Expensive #liquid-glow and #neon-line filters to fix lag */}

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

        {/* Optimized: Edges Layer */}
        <EdgesLayer 
          edges={world.edges} 
          nodes={world.nodes} 
          selectedNodeId={selectedNodeId} 
        />

        {/* Drag Line Visual */}
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

        {/* Dynamic: Nodes Layer */}
        <g>
          {world.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isHover = hoverNodeId === node.id;
            const isDraggingSource = dragSourceId === node.id;
            
            const currentRadius = getDynamicRadius(node.count);
            const color = COLOR_MAP[node.owner];
            
            let isTargetable = false;
            // Check targetability from selection OR from current drag
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
                     // Replaced CSS animation with static render for perf, or simple CSS if needed.
                     // A simple rotation is fine if not on 50 elements. 
                     // Keeping it simple to ensure smoothness.
                   />
                )}

                {/* Main Body - Removed Filter */}
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
                
                {/* Capacity Ring - Optimized */}
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
      
      {/* HUD */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none opacity-80">
         <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-sm px-4 py-1.5 rounded-full border border-slate-700/30">
           <Activity className={`w-3 h-3 ${timeLeft < 10 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} />
           <span className="font-mono-lab text-xs text-slate-300 font-medium tracking-wide">
             CYCLE: {timeLeft.toString().padStart(2, '0')}s
           </span>
         </div>
      </div>

    </div>
  );
};

export default GameMap;