import React, { useRef, useState, useEffect, memo, useLayoutEffect } from 'react';
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
        let opacity = 0.5;
        let dashArray = "none";
        let filter = "";

        if (isRandom) {
          strokeColor = isSelected ? "#fcd34d" : "#d97706";
          strokeWidth = isSelected ? 2 : 1.5;
          opacity = isSelected ? 1 : 0.6;
          dashArray = "6, 4";
          filter = "url(#neon-line)";
        } else {
          strokeColor = isSelected ? "#38bdf8" : "#334155";
          strokeWidth = isSelected ? 4 : 2.5;
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
                opacity={0.2}
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
              filter={filter}
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
  playerColor: string; // Using string to match generic type, though usually PlayerColor
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

  // --- Timer Logic ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((nextCurrentTime - now) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [nextCurrentTime]);

  // --- Canvas Rendering for Payloads (High Performance) ---
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous frame
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    world.payloads.forEach(p => {
      const cx = p.startX + (p.endX - p.startX) * p.progress;
      const cy = p.startY + (p.endY - p.startY) * p.progress;
      const color = COLOR_MAP[p.owner];

      // 1. Draw Glow (Fake Halo)
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.fill();

      // 2. Draw Core
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color; 
      ctx.globalAlpha = 1.0;
      ctx.fill();

      // 3. Draw White Center (Highlight)
      ctx.beginPath();
      ctx.arc(cx, cy, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.8;
      ctx.fill();
    });

    ctx.globalAlpha = 1.0;

  }, [world.payloads]);

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

  const handleSvgMouseDown = () => {
     // Intentionally empty for now, could clear selection but handleBgClick does that
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    if (dragSourceId) {
        setDragEnd(getCursorPoint(e));
    }
  };

  const handleSvgMouseUp = () => {
    // If dragging and dropped on background, cancel drag
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
    // Only allow left click drag for own nodes
    if (e.button !== 0 || node.owner !== playerColor) return;
    
    setDragSourceId(node.id);
    setDragEnd({ x: node.x, y: node.y });
  };

  const handleNodeMouseUp = (node: Node, e: React.MouseEvent) => {
    // Check if this is a Drop action (Drag started elsewhere)
    if (dragSourceId && dragSourceId !== node.id) {
        e.stopPropagation(); // Prevent bg click handling
        
        // Check connectivity
        const isConnected = world.edges.some(edge => 
           (edge.source === dragSourceId && edge.target === node.id) || 
           (edge.source === node.id && edge.target === dragSourceId)
        );

        if (isConnected) {
             const isContinuous = e.ctrlKey || e.metaKey;
             onAttack(dragSourceId, node.id, isContinuous);
             // Clear selection to avoid confusion after a drag action
             setSelectedNodeId(null);
        }
        
        // Reset Drag State
        setDragSourceId(null);
        setDragEnd(null);
    }
    // If dragSourceId === node.id, we do nothing here. 
    // The onClick handler will fire next and handle the standard selection logic.
  };

  const handleNodeClick = (node: Node, e: React.MouseEvent) => {
    // Standard Selection Logic (Fallback for Click interaction)
    
    // If we just finished a valid drag, dragSourceId would be null by now (cleared in MouseUp).
    // But if MouseUp cleared it because it was a drop, we stopped propagation, so onClick shouldn't fire on the target.
    // If MouseUp saw source==target, it let it bubble. So here we handle "Click on Self".

    if (!selectedNodeId) {
      if (node.owner === playerColor) {
        setSelectedNodeId(node.id);
      }
      return;
    }

    if (selectedNodeId) {
      if (node.id === selectedNodeId) {
        setSelectedNodeId(null); // Deselect self
        return;
      }

      // Check for Click-to-Attack (Sequence: Click A -> Click B)
      const isConnected = world.edges.some(edge => 
        (edge.source === selectedNodeId && edge.target === node.id) ||
        (edge.source === node.id && edge.target === selectedNodeId)
      );

      if (isConnected) {
        const isContinuous = e.ctrlKey || e.metaKey;
        onAttack(selectedNodeId, node.id, isContinuous);
        setSelectedNodeId(null); 
      } else {
        // Change selection
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
        onMouseDown={handleSvgMouseDown}
      >
        <defs>
          <pattern id="organic-grid" width="100" height="100" patternUnits="userSpaceOnUse">
             <circle cx="20" cy="20" r="1.5" fill="#334155" opacity="0.3" />
             <circle cx="70" cy="60" r="1" fill="#334155" opacity="0.2" />
             <circle cx="50" cy="10" r="1" fill="#334155" opacity="0.2" />
          </pattern>
          
          <filter id="liquid-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feSpecularLighting result="specular" in="coloredBlur" specularExponent="20" lightingColor="#ffffff">
               <fePointLight x="0" y="0" z="100" />
            </feSpecularLighting>
            <feComposite in="specular" in2="SourceAlpha" operator="in" result="specularComposite" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="specularComposite" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="neon-line" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

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
                className="pointer-events-none animate-pulse"
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
                className="cursor-pointer transition-all duration-300 ease-out"
                style={{ 
                  transformOrigin: `${node.x}px ${node.y}px`,
                  transform: (isHover || isDraggingSource) ? 'scale(1.08)' : 'scale(1)'
                }}
              >
                {(isSelected || isDraggingSource || (isTargetable && isHover)) && (
                   <circle
                     cx={node.x} cy={node.y}
                     r={currentRadius + 6}
                     fill="none"
                     stroke={isSelected || isDraggingSource ? '#fff' : color}
                     strokeWidth={1}
                     strokeOpacity={0.5}
                     strokeDasharray="4 2"
                     className="animate-[spin_6s_linear_infinite]"
                   />
                )}

                <circle
                  cx={node.x}
                  cy={node.y}
                  r={currentRadius}
                  fill={node.owner === 'GRAY' ? '#1e293b' : color}
                  fillOpacity={node.owner === 'GRAY' ? 0.5 : 0.2}
                  stroke={node.owner === 'GRAY' ? '#475569' : color}
                  strokeWidth={isSelected || isDraggingSource ? 2 : 1.5}
                  strokeOpacity={0.8}
                  filter={node.owner !== 'GRAY' ? "url(#liquid-glow)" : ""}
                />
                
                <circle
                  cx={node.x} cy={node.y}
                  r={currentRadius * 0.9}
                  fill={`url(#grad-cell-${node.owner})`}
                />

                <circle
                  cx={node.x} cy={node.y}
                  r={currentRadius * 0.35}
                  fill={`url(#grad-core-${node.owner})`}
                  opacity={0.9}
                  className={`${node.owner !== 'GRAY' ? 'animate-pulse' : ''}`}
                />

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