
import React, { memo } from 'react';
import { Edge, Node } from '../../types';

interface EdgesLayerProps {
  edges: Edge[];
  nodes: Node[];
  selectedNodeId: string | null;
}

const EdgesLayer = memo(({ edges, nodes, selectedNodeId }: EdgesLayerProps) => {
  return (
    <g className="pointer-events-none">
      {edges.map((edge, i) => {
        const s = nodes.find(n => n.id === edge.source);
        const t = nodes.find(n => n.id === edge.target);
        
        // Safety check
        if (!s || !t) return null;

        const isRandom = edge.type === 'RANDOM';
        const isSelected = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);

        // VISUAL UPDATE: Much brighter, more visible connections
        let strokeColor = "#64748b"; // Base fallback
        let strokeWidth = 2;
        let opacity = 0.5; 
        let dashArray = "none";
        
        if (isRandom) {
          // Random edges: Bright Amber/Gold, distinctly dashed
          strokeColor = isSelected ? "#fbbf24" : "#d97706"; // amber-400 : amber-600
          strokeWidth = isSelected ? 3 : 2.5; 
          opacity = isSelected ? 0.9 : 0.6; 
          dashArray = "8, 6"; // Longer dashes
        } else {
          // Permanent edges: Electric Blue/Cyan, thick solid lines
          strokeColor = isSelected ? "#22d3ee" : "#0ea5e9"; // cyan-400 : sky-500
          strokeWidth = isSelected ? 4 : 3;
          opacity = isSelected ? 0.9 : 0.5;
          dashArray = "none";
        }

        return (
          <g key={`${edge.source}-${edge.target}-${i}`}>
            {/* Outer Glow for active/permanent edges to make them pop against dark bg */}
            {!isRandom && (
                <line 
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={strokeColor}
                strokeWidth={strokeWidth + 4}
                opacity={0.15}
                strokeLinecap="round"
                />
            )}
            
            {/* Main Line */}
            <line 
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              opacity={opacity}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
            
            {/* Animated Flow effect on selection (Optional overlay) */}
            {isSelected && (
               <line 
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke="white"
                strokeWidth={1}
                strokeDasharray="10, 20"
                opacity={0.5}
                className="animate-[dash_1s_linear_infinite]"
               />
            )}
          </g>
        );
      })}
    </g>
  );
}, (prev, next) => {
  return prev.edges === next.edges && prev.selectedNodeId === next.selectedNodeId;
});

export default EdgesLayer;
