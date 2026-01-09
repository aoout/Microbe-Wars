
import React, { useRef, useState, useEffect } from 'react';
import { GameWorld, Node } from '../../types';
import { COLOR_MAP, GAME_HEIGHT, GAME_WIDTH, NODE_RADIUS_BASE } from '../../constants';

// Sub-components
import EdgesLayer from './EdgesLayer';
import GameHUD from './GameHUD';
import PauseOverlay from './PauseOverlay';

// --- Constants for Visual FX ---
interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0 to 1
  color: string;
  size: number;
}

interface NodePhysicsState {
  id: string;
  x: number; // Original X
  y: number; // Original Y
  offsetX: number; // Current visual offset
  offsetY: number;
  velocityX: number;
  velocityY: number;
}

// --- Helper Functions for Shapes ---

// Generate a symmetric 3-claw/petal shape rotated around center
const getHiveClawPath = (cx: number, cy: number, r: number, rotation: number) => {
    // Convert degrees to radians
    const rad = (deg: number) => (deg + rotation) * (Math.PI / 180);

    const outerTip = { x: cx + r * Math.cos(rad(0)), y: cy + r * Math.sin(rad(0)) };
    const innerLeft = { x: cx + (r*0.4) * Math.cos(rad(-40)), y: cy + (r*0.4) * Math.sin(rad(-40)) };
    const innerRight = { x: cx + (r*0.4) * Math.cos(rad(40)), y: cy + (r*0.4) * Math.sin(rad(40)) };
    const control1 = { x: cx + (r*0.8) * Math.cos(rad(-20)), y: cy + (r*0.8) * Math.sin(rad(-20)) };
    const control2 = { x: cx + (r*0.8) * Math.cos(rad(20)), y: cy + (r*0.8) * Math.sin(rad(20)) };

    return `
      M ${innerLeft.x},${innerLeft.y}
      Q ${control1.x},${control1.y} ${outerTip.x},${outerTip.y}
      Q ${control2.x},${control2.y} ${innerRight.x},${innerRight.y}
      Z
    `;
};

// Generate an Octagon / Cut-corner square
const getFortressPath = (cx: number, cy: number, r: number) => {
    const d = r * 2; // full width
    const c = d * 0.3; // corner cut size
    const x = cx - r;
    const y = cy - r;
    
    return `
      M ${x + c},${y} 
      L ${x + d - c},${y} 
      L ${x + d},${y + c} 
      L ${x + d},${y + d - c} 
      L ${x + d - c},${y + d} 
      L ${x + c},${y + d} 
      L ${x},${y + d - c} 
      L ${x},${y + c} 
      Z
    `;
};

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
  
  // Drag State (Path based now)
  const [dragPath, setDragPath] = useState<string[]>([]);
  const [dragCurrentPos, setDragCurrentPos] = useState<{x: number, y: number} | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Resize / Layout State
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutDims, setLayoutDims] = useState({ width: GAME_WIDTH, height: GAME_HEIGHT });

  const latestWorldRef = useRef(world);

  // Visual Physics Refs
  const nodePhysicsMap = useRef<Map<string, NodePhysicsState>>(new Map());
  const splashParticles = useRef<SplashParticle[]>([]);

  // --- Layout Resize Logic ---
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const parent = containerRef.current;
      const { clientWidth: pw, clientHeight: ph } = parent;
      
      const targetRatio = GAME_WIDTH / GAME_HEIGHT;
      const parentRatio = pw / ph;

      let w, h;
      if (parentRatio > targetRatio) {
         h = ph;
         w = ph * targetRatio;
      } else {
         w = pw;
         h = pw / targetRatio;
      }
      
      setLayoutDims({ width: w, height: h });
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    setTimeout(handleResize, 100);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    latestWorldRef.current = world;
    
    // Process new impact events immediately
    if (world.latestEvents && world.latestEvents.length > 0) {
       world.latestEvents.forEach(evt => {
         if (evt.type === 'IMPACT') {
            const node = world.nodes.find(n => n.id === evt.targetId);
            if (!node) return;

            // 1. Trigger Jelly Physics
            if (!nodePhysicsMap.current.has(node.id)) {
               nodePhysicsMap.current.set(node.id, {
                 id: node.id, x: node.x, y: node.y,
                 offsetX: 0, offsetY: 0, velocityX: 0, velocityY: 0
               });
            }
            const phys = nodePhysicsMap.current.get(node.id)!;
            
            // Impact pushes the node slightly in direction of travel
            const push = evt.force * 6.0 * 0.03; 
            phys.velocityX += Math.cos(evt.angle) * push;
            phys.velocityY += Math.sin(evt.angle) * push;

            // 2. Trigger Splash Particles (Cell Fluid)
            const splashCount = Math.random() < 0.56 ? 1 : 0;
            
            const hitX = node.x - Math.cos(evt.angle) * (node.radius + 5);
            const hitY = node.y - Math.sin(evt.angle) * (node.radius + 5);

            for (let i = 0; i < splashCount; i++) {
                const spread = (Math.random() - 0.5) * 1.5; 
                const speed = 1.5 + Math.random() * 2; 
                const splashAngle = evt.angle + Math.PI + spread;
                
                splashParticles.current.push({
                   x: hitX,
                   y: hitY,
                   vx: Math.cos(splashAngle) * speed,
                   vy: Math.sin(splashAngle) * speed,
                   life: 1.0,
                   color: COLOR_MAP[evt.color],
                   size: 1 + Math.random() * 1.5
                });
            }
         }
       });
    }
  }, [world]);

  // --- Timer Logic ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPaused) return;
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((nextCurrentTime - now) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [nextCurrentTime, isPaused]);

  // --- Render Loop (Canvas + DOM Physics) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true }); 
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      // A. Update & Render Travel Payloads (LIGHT SHUTTLES)
      const payloads = latestWorldRef.current.payloads;
      
      ctx.shadowBlur = 8;
      
      for (let i = 0; i < payloads.length; i++) {
        const p = payloads[i];
        
        const cx = p.startX + (p.endX - p.startX) * p.progress;
        const cy = p.startY + (p.endY - p.startY) * p.progress;
        const color = COLOR_MAP[p.owner];

        const dx = p.endX - p.startX;
        const dy = p.endY - p.startY;
        const angle = Math.atan2(dy, dx);
        
        const trailLength = 20 + (p.speed * 200); 
        const headRadius = 3.5;
        
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const tailX = cx - cos * trailLength;
        const tailY = cy - sin * trailLength;
        
        const gradient = ctx.createLinearGradient(cx, cy, tailX, tailY);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = gradient;
        ctx.shadowColor = color; 
        
        ctx.beginPath();
        ctx.arc(cx, cy, headRadius, angle - Math.PI/2, angle + Math.PI/2);
        ctx.lineTo(tailX, tailY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0; 
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 8;
      }
      ctx.shadowBlur = 0; 

      // B. Update & Render Splash Particles
      for (let i = splashParticles.current.length - 1; i >= 0; i--) {
         const sp = splashParticles.current[i];
         sp.x += sp.vx;
         sp.y += sp.vy;
         sp.vx *= 0.95; 
         sp.vy *= 0.95;
         sp.life -= 0.03; 

         if (sp.life <= 0) {
             splashParticles.current.splice(i, 1);
         } else {
             ctx.fillStyle = sp.color;
             ctx.globalAlpha = sp.life;
             ctx.beginPath();
             ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
             ctx.fill();
             ctx.globalAlpha = 1.0;
         }
      }

      // C. Spring Physics for Nodes
      nodePhysicsMap.current.forEach((phys) => {
          const k = 0.08; 
          const c = 0.85; 
          
          const forceX = -k * phys.offsetX;
          const forceY = -k * phys.offsetY;
          
          phys.velocityX += forceX;
          phys.velocityY += forceY;
          
          phys.velocityX *= c;
          phys.velocityY *= c;
          
          phys.offsetX += phys.velocityX;
          phys.offsetY += phys.velocityY;

          if (Math.abs(phys.offsetX) > 0.01 || Math.abs(phys.offsetY) > 0.01) {
              const el = document.getElementById(`node-group-${phys.id}`);
              if (el) {
                  el.style.transform = `translate(${phys.offsetX.toFixed(2)}px, ${phys.offsetY.toFixed(2)}px)`;
                  el.style.transformOrigin = `${phys.x}px ${phys.y}px`;
              }
          }
      });

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
    if (dragPath.length > 0) {
        setDragCurrentPos(getCursorPoint(e));
    }
  };

  const handleSvgMouseUp = (e: React.MouseEvent) => {
    if (dragPath.length > 0) {
        if (dragPath.length >= 2) {
             const isContinuous = e.ctrlKey || e.metaKey;
             for (let i = 0; i < dragPath.length - 1; i++) {
                 const fromId = dragPath[i];
                 const toId = dragPath[i+1];
                 onAttack(fromId, toId, isContinuous);
             }
        }
        setDragPath([]);
        setDragCurrentPos(null);
        setSelectedNodeId(null);
    }
  };

  const handleBgClick = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setSelectedNodeId(null);
    }
  };

  const handleNodeMouseDown = (node: Node, e: React.MouseEvent) => {
    if (e.button !== 0 || node.owner !== playerColor) return;
    setDragPath([node.id]);
    setDragCurrentPos({ x: node.x, y: node.y });
    if (onTutorialClick && tutorialTargetId === node.id) {
       onTutorialClick();
    }
  };

  const handleNodeMouseEnter = (node: Node) => {
      setHoverNodeId(node.id);
      if (dragPath.length > 0) {
          const lastId = dragPath[dragPath.length - 1];
          if (node.id === lastId) return;
          if (dragPath.length >= 2 && node.id === dragPath[dragPath.length - 2]) {
              setDragPath(prev => prev.slice(0, -1));
              return;
          }
          const lastNode = world.nodes.find(n => n.id === lastId);
          if (!lastNode) return;
          if (lastNode.owner !== playerColor) return;
          const isConnected = world.edges.some(edge => 
            (edge.source === lastId && edge.target === node.id) || 
            (edge.source === node.id && edge.target === lastId)
          );
          if (isConnected) {
              setDragPath(prev => [...prev, node.id]);
          }
      }
  };

  const handleNodeMouseUp = (node: Node, e: React.MouseEvent) => {
    if (dragPath.length === 1 && dragPath[0] === node.id) {
        e.stopPropagation();
        handleNodeClick(node, e);
        setDragPath([]);
        setDragCurrentPos(null);
        return;
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

  const getNodePos = (id: string) => {
      const n = world.nodes.find(node => node.id === id);
      return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
  };

  return (
    <div 
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden select-none z-10 bg-transparent"
    >
      <div 
        style={{ 
            width: layoutDims.width, 
            height: layoutDims.height 
        }}
        className="relative shadow-2xl transition-all duration-75 ease-linear"
      >
          {/* 1. Canvas Layer (Units) */}
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="absolute inset-0 w-full h-full z-20 pointer-events-none"
          />

          {/* 2. SVG Layer (Map & Nodes) */}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${GAME_WIDTH} ${GAME_HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full z-10"
            onClick={handleBgClick}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
          >
            <defs>
              <pattern id="organic-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1.5" fill="#334155" opacity="0.3" />
                <circle cx="70" cy="60" r="1" fill="#334155" opacity="0.2" />
              </pattern>

              <pattern id="hex-plate" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="10" height="10" fill="none" />
                <path d="M 0 5 L 10 5 M 5 0 L 5 10" stroke="white" strokeWidth="1" opacity="0.15" />
              </pattern>
              
              <pattern id="bio-goo" width="6" height="6" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="black" opacity="0.2" />
                <circle cx="5" cy="5" r="1" fill="black" opacity="0.1" />
              </pattern>
              
              {world.nodes.map(node => (
                <React.Fragment key={`grad-${node.id}`}>
                    <radialGradient id={`cell-body-${node.owner}`} cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
                        <stop offset="40%" stopColor={COLOR_MAP[node.owner]} stopOpacity="0.3" />
                        <stop offset="85%" stopColor={COLOR_MAP[node.owner]} stopOpacity="0.8" />
                        <stop offset="100%" stopColor={COLOR_MAP[node.owner]} stopOpacity="0.2" />
                    </radialGradient>

                    <radialGradient id={`ink-transition-${node.id}`} cx="50%" cy="50%" r="50%">
                        <stop offset={`${Math.max(0, node.captureProgress * 100 - 20)}%`} stopColor={COLOR_MAP[node.owner]} />
                        <stop offset={`${Math.min(100, node.captureProgress * 100)}%`} stopColor={COLOR_MAP[node.owner]} stopOpacity="0.8" />
                        <stop offset={`${Math.min(100, node.captureProgress * 100 + 10)}%`} stopColor={COLOR_MAP[node.prevOwner || node.owner]} />
                    </radialGradient>
                </React.Fragment>
              ))}
              
              <radialGradient id="cell-core-general" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              
              <filter id="glow-soft">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>

              <filter id="glow-strong">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#organic-grid)" />

            <EdgesLayer 
              edges={world.edges} 
              nodes={world.nodes} 
              selectedNodeId={selectedNodeId} 
            />

            {/* Drag Line Path */}
            {dragPath.length > 0 && dragCurrentPos && (
                <g className="pointer-events-none">
                    {dragPath.map((id, index) => {
                        if (index === dragPath.length - 1) return null;
                        const cur = getNodePos(id);
                        const next = getNodePos(dragPath[index+1]);
                        return (
                            <line
                                key={`drag-seg-${index}`}
                                x1={cur.x} y1={cur.y} x2={next.x} y2={next.y}
                                stroke={COLOR_MAP[playerColor as keyof typeof COLOR_MAP] || '#fff'}
                                strokeWidth="4" strokeLinecap="round" opacity="0.8"
                            />
                        );
                    })}
                    
                    {(() => {
                        const lastPos = getNodePos(dragPath[dragPath.length - 1]);
                        return (
                            <line
                                x1={lastPos.x} y1={lastPos.y} x2={dragCurrentPos.x} y2={dragCurrentPos.y}
                                stroke={COLOR_MAP[playerColor as keyof typeof COLOR_MAP] || '#fff'}
                                strokeWidth="3" strokeDasharray="8 6" strokeLinecap="round" opacity="0.6"
                            />
                        );
                    })()}
                </g>
            )}

            <g>
              {world.nodes.map((node, index) => {
                const isSelected = selectedNodeId === node.id;
                const isHover = hoverNodeId === node.id;
                const isInDragPath = dragPath.includes(node.id);
                const isTutorialTarget = tutorialTargetId === node.id;
                
                const baseRadius = getDynamicRadius(node.count);
                const displayRadius = (isHover || isInDragPath) ? baseRadius * 1.1 : baseRadius;
                
                const color = COLOR_MAP[node.owner];
                
                let isTargetable = false;
                if (selectedNodeId && selectedNodeId !== node.id) {
                  isTargetable = world.edges.some(e => 
                    (e.source === selectedNodeId && e.target === node.id) ||
                    (e.source === node.id && e.target === selectedNodeId)
                  );
                }

                if (!nodePhysicsMap.current.has(node.id)) {
                    nodePhysicsMap.current.set(node.id, {
                        id: node.id, x: node.x, y: node.y, offsetX: 0, offsetY: 0, velocityX: 0, velocityY: 0
                    });
                }

                let shapeElement = null;
                let membraneElement = null;
                let nucleusElement = null;
                let selectionElement = null;

                if (node.type === 'FORTRESS') {
                  const r = displayRadius * 0.95;
                  const fortressPath = getFortressPath(node.x, node.y, r);
                  const platingPath = getFortressPath(node.x, node.y, r * 0.7);

                  shapeElement = (
                      <g>
                          <path
                            d={fortressPath}
                            fill={node.captureProgress < 1 ? `url(#ink-transition-${node.id})` : color}
                            fillOpacity={0.8}
                            stroke={color} strokeWidth={1}
                          />
                          <path d={fortressPath} fill="url(#hex-plate)" opacity={0.4} />
                          <path
                            d={platingPath}
                            fill={color} fillOpacity={0.3}
                            stroke={color} strokeWidth={2}
                          />
                          <circle cx={node.x - r*0.7} cy={node.y - r*0.7} r={2} fill="white" opacity={0.8} />
                          <circle cx={node.x + r*0.7} cy={node.y - r*0.7} r={2} fill="white" opacity={0.8} />
                          <circle cx={node.x - r*0.7} cy={node.y + r*0.7} r={2} fill="white" opacity={0.8} />
                          <circle cx={node.x + r*0.7} cy={node.y + r*0.7} r={2} fill="white" opacity={0.8} />
                      </g>
                  );
                  membraneElement = (
                      <g>
                          <g style={{ transformOrigin: `${node.x}px ${node.y}px` }} className="animate-[spin_10s_linear_infinite]">
                                <path d={getFortressPath(node.x, node.y, r + 4)} fill="none" stroke={color} strokeWidth={1} strokeDasharray="10 10" strokeOpacity={0.6} />
                          </g>
                          <g style={{ transformOrigin: `${node.x}px ${node.y}px` }} className="animate-[spin_15s_linear_reverse_infinite]">
                                <path d={getFortressPath(node.x, node.y, r + 8)} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4 20" strokeOpacity={0.4} />
                          </g>
                      </g>
                  );
                  nucleusElement = (
                      <rect
                        x={node.x - r * 0.25} y={node.y - r * 0.25} width={r * 0.5} height={r * 0.5}
                        fill="white" filter="url(#glow-strong)"
                        className="animate-[pulse_4s_ease-in-out_infinite]"
                      />
                  );
                  selectionElement = (
                      <path
                        d={getFortressPath(node.x, node.y, r + 12)}
                        fill="none" stroke={isSelected || isInDragPath ? '#fff' : color}
                        strokeWidth={2} strokeOpacity={0.9} strokeDasharray="4 4"
                        className="animate-[pulse_2s_linear_infinite]"
                      />
                  );

                } else if (node.type === 'HIVE') {
                  const r = displayRadius * 1.3; 
                  const claw0 = getHiveClawPath(node.x, node.y, r, 0);
                  const claw1 = getHiveClawPath(node.x, node.y, r, 120);
                  const claw2 = getHiveClawPath(node.x, node.y, r, 240);

                  shapeElement = (
                      <g className="animate-[spin_12s_linear_infinite]" style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
                          <circle cx={node.x} cy={node.y} r={r * 0.5} fill={color} fillOpacity={0.4} />
                          <path d={claw0} fill={node.captureProgress < 1 ? `url(#ink-transition-${node.id})` : color} fillOpacity={0.8} />
                          <path d={claw1} fill={node.captureProgress < 1 ? `url(#ink-transition-${node.id})` : color} fillOpacity={0.8} />
                          <path d={claw2} fill={node.captureProgress < 1 ? `url(#ink-transition-${node.id})` : color} fillOpacity={0.8} />
                          <path d={claw0} fill="url(#bio-goo)" opacity={0.3} />
                          <path d={claw1} fill="url(#bio-goo)" opacity={0.3} />
                          <path d={claw2} fill="url(#bio-goo)" opacity={0.3} />
                      </g>
                  );
                  membraneElement = (
                      <g className="animate-[spin_8s_linear_reverse_infinite]" style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
                            <circle cx={node.x} cy={node.y} r={r * 0.8} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.3} strokeDasharray="2 4" />
                      </g>
                  );
                  nucleusElement = (
                      <g>
                          <circle cx={node.x} cy={node.y} r={r * 0.3} fill={color} opacity={0.4} filter="url(#glow-strong)" className="animate-[pulse_2s_ease-in-out_infinite]" />
                          <circle cx={node.x} cy={node.y} r={r * 0.15} fill="white" className="animate-[pulse_1s_ease-in-out_infinite]" />
                          <g className="animate-[spin_3s_linear_infinite]" style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
                                <circle cx={node.x} cy={node.y - r} r={3} fill={color} filter="url(#glow-soft)" />
                                <circle cx={node.x + r*0.866} cy={node.y + r*0.5} r={2} fill={color} filter="url(#glow-soft)" />
                                <circle cx={node.x - r*0.866} cy={node.y + r*0.5} r={2.5} fill={color} filter="url(#glow-soft)" />
                          </g>
                      </g>
                  );
                  selectionElement = (
                      <circle
                        cx={node.x} cy={node.y} r={r + 8} fill="none"
                        stroke={isSelected || isInDragPath ? '#fff' : color}
                        strokeWidth={2} strokeOpacity={0.9} strokeDasharray="2 3"
                        className="animate-[spin_20s_linear_infinite]"
                        style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                      />
                  );

                } else {
                  shapeElement = (
                        <circle
                          cx={node.x} cy={node.y} r={displayRadius}
                          fill={node.captureProgress < 1 ? `url(#ink-transition-${node.id})` : `url(#cell-body-${node.owner})`}
                          className="transition-all duration-300"
                        />
                  );
                  membraneElement = (
                        <circle
                          cx={node.x} cy={node.y} r={displayRadius}
                          fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.6} filter="url(#glow-soft)"
                        />
                  );
                  nucleusElement = (
                        <circle
                          cx={node.x} cy={node.y} r={displayRadius * 0.4}
                          fill="url(#cell-core-general)" opacity={0.6} filter="url(#glow-soft)" className="animate-pulse"
                        />
                  );
                  selectionElement = (
                      <circle
                        cx={node.x} cy={node.y} r={displayRadius + 8}
                        fill="none" stroke={isSelected || isInDragPath ? '#fff' : color}
                        strokeWidth={1.5} strokeOpacity={0.8} strokeDasharray="2 4"
                        className="animate-[spin_4s_linear_infinite]"
                        style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                      />
                  );
                }

                return (
                  <g
                    key={node.id}
                    id={`node-group-${node.id}`}
                    style={{ transformOrigin: `${node.x}px ${node.y}px`, animationDelay: `${index * -0.5}s` }}
                    className="cursor-pointer"
                    onMouseDown={(e) => handleNodeMouseDown(node, e)}
                    onMouseEnter={() => handleNodeMouseEnter(node)}
                    onMouseLeave={() => setHoverNodeId(null)}
                    onMouseUp={(e) => handleNodeMouseUp(node, e)}
                    onClick={(e) => { e.stopPropagation(); }} 
                  >
                    {isTutorialTarget && (
                      <g className="pointer-events-none animate-spin-slow" style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
                        <circle cx={node.x} cy={node.y} r={displayRadius + 20} fill="none" stroke="#eab308" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
                        <path d={`M ${node.x} ${node.y - displayRadius - 25} L ${node.x} ${node.y - displayRadius - 15}`} stroke="#eab308" strokeWidth="2" />
                        <path d={`M ${node.x} ${node.y + displayRadius + 25} L ${node.x} ${node.y + displayRadius + 15}`} stroke="#eab308" strokeWidth="2" />
                      </g>
                    )}

                    {(isSelected || isInDragPath || (isTargetable && isHover)) && selectionElement}
                    
                    {isInDragPath && (
                        <circle cx={node.x} cy={node.y} r={displayRadius + 12} stroke="white" strokeWidth="1" opacity="0.5" fill="none" />
                    )}

                    <g style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
                        {shapeElement}
                        {membraneElement}
                        {nucleusElement}
                    </g>

                    <text
                      x={node.x} y={node.y} dy=".35em" textAnchor="middle"
                      className="font-mono-lab font-bold fill-white pointer-events-none drop-shadow-md select-none"
                      style={{ fontSize: Math.max(10, displayRadius * 0.5), textShadow: `0 0 4px ${color}` }}
                    >
                      {Math.floor(node.count)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
      </div>
      
      <GameHUD 
        timeLeft={timeLeft}
        isPaused={isPaused}
        onTogglePause={onTogglePause}
        isAutoPilot={isAutoPilot}
        onToggleAutoPilot={onToggleAutoPilot}
        hideControls={!!tutorialTargetId}
      />

      <PauseOverlay 
        isPaused={isPaused}
        onResume={onTogglePause}
      />

    </div>
  );
};

export default GameMap;
