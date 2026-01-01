
import { forceSimulation, forceManyBody, forceCollide, forceX, forceY, SimulationNodeDatum } from 'd3-force';
import { Node, Edge, PlayerColor, GameWorld, DifficultyLevel, NodeType } from '../types';
import { GAME_WIDTH, GAME_HEIGHT, INITIAL_PLAYER_COUNT, NODE_RADIUS_BASE, PLAYABLE_COLORS, MAX_CAPACITY_BASE, BASE_SPAWN_INTERVAL_MS, DIFFICULTY_SETTINGS } from '../constants';

// --- Map Generation ---

interface SimNode extends SimulationNodeDatum {
  id: string;
  r: number;
  x?: number;
  y?: number;
}

export const generateMap = (playerColor: PlayerColor): { nodes: Node[], edges: Edge[] } => {
  // Requirement: Fixed 24 nodes
  const nodeCount = 24;
  
  // 1. Create Nodes with random initial positions across the canvas
  // Spread them out initially to avoid center clustering
  const padding = 50;
  const simNodes: SimNode[] = Array.from({ length: nodeCount }, (_, i) => ({
    id: `node-${i}`,
    r: NODE_RADIUS_BASE, 
    // Random position within safe bounds
    x: padding + Math.random() * (GAME_WIDTH - 2 * padding),
    y: padding + Math.random() * (GAME_HEIGHT - 2 * padding)
  }));

  // 2. Run D3 Simulation to space them out evenly
  // Use forceX/forceY instead of forceCenter to better respect the rectangular aspect ratio
  const simulation = forceSimulation(simNodes)
    // Strong repulsion to spread them uniformly
    .force("charge", forceManyBody().strength(-300))
    // Strict collision detection:
    // Radius * 2.5 ensures enough space for nodes to grow to max size (approx 2.2x) without overlapping
    .force("collide", forceCollide().radius((d: any) => d.r * 2.5).strength(1).iterations(3))
    // Gentle pull to center to keep them on screen, stronger on Y to fit 800px height
    .force("x", forceX(GAME_WIDTH / 2).strength(0.02))
    .force("y", forceY(GAME_HEIGHT / 2).strength(0.04))
    .stop();

  // Run more ticks to ensure a stable, non-overlapping layout
  for (let i = 0; i < 800; ++i) simulation.tick();

  // 3. Convert to Game Nodes
  const nodes: Node[] = simNodes.map(n => ({
    id: n.id,
    // Clamp to screen bounds with padding
    x: Math.max(n.r * 2.5, Math.min(GAME_WIDTH - n.r * 2.5, n.x!)), 
    y: Math.max(n.r * 2.5, Math.min(GAME_HEIGHT - n.r * 2.5, n.y!)),
    owner: PlayerColor.GRAY,
    // Randomize initial count for neutral nodes between 10 and 30
    count: Math.floor(Math.random() * (30 - 10 + 1)) + 10,
    capacity: MAX_CAPACITY_BASE, // Standard capacity for all
    radius: n.r, // Base radius stored here
    growthAccumulator: 0, // Init accumulator
    captureProgress: 1, // Start fully settled
    prevOwner: PlayerColor.GRAY,
    type: 'DEFAULT'
  }));

  // 4. Create Edges (MST + Random)
  const edges = generateEdgesForNodes(nodes);

  // 5. Assign Starting Positions
  // "Players choose one, others are AI, rest are Gray"
  const opponents = PLAYABLE_COLORS.filter(c => c !== playerColor);
  const activeColors = [playerColor, ...opponents];

  // Pick random distinct indices for starting positions
  const indices = Array.from({ length: nodes.length }, (_, i) => i);
  // Shuffle indices
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  activeColors.forEach((color, i) => {
    const nodeIdx = indices[i];
    nodes[nodeIdx].owner = color;
    nodes[nodeIdx].prevOwner = color;
    nodes[nodeIdx].count = INITIAL_PLAYER_COUNT;
  });

  return { nodes, edges };
};

// --- Honeycomb Map Generation (New Mode) ---

export const generateHoneycombMap = (playerColor: PlayerColor): { nodes: Node[], edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeLayerMap = new Map<string, number>(); // Track which layer each node is in
  
  // Hex Grid Configuration
  const mapRadius = 3; // 0 (center) + 3 rings = 37 nodes total
  const hexSize = 85; // Pixel spacing
  const centerX = GAME_WIDTH / 2;
  const centerY = GAME_HEIGHT / 2;
  
  // Helper to convert Axial coords to Screen Coords
  // Pointy-topped hex orientation
  const hexToPixel = (q: number, r: number) => {
    const x = hexSize * (Math.sqrt(3) * q + (Math.sqrt(3)/2) * r);
    const y = hexSize * ((3/2) * r);
    return { x: centerX + x, y: centerY + y };
  };

  // 1. Generate Grid Nodes
  // Constraint for hexagonal shape: max(abs(q), abs(r), abs(-q-r)) <= mapRadius
  for (let q = -mapRadius; q <= mapRadius; q++) {
    for (let r = -mapRadius; r <= mapRadius; r++) {
      const s = -q - r;
      if (Math.abs(q) <= mapRadius && Math.abs(r) <= mapRadius && Math.abs(s) <= mapRadius) {
        
        const pos = hexToPixel(q, r);
        
        // Determine "Layer" (Distance from center)
        const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
        const id = `hex-${q}-${r}`;
        
        nodeLayerMap.set(id, distance);

        // Determine capacity based on layer (Center is juicier)
        const baseCap = MAX_CAPACITY_BASE;
        const cap = distance === 0 ? baseCap * 1.5 : baseCap;

        nodes.push({
          id: id,
          x: pos.x,
          y: pos.y,
          owner: PlayerColor.GRAY,
          count: distance === 0 ? 50 : (10 + Math.floor(Math.random() * 10)), // Center is stronger neutral
          capacity: cap,
          radius: NODE_RADIUS_BASE,
          growthAccumulator: 0,
          captureProgress: 1,
          prevOwner: PlayerColor.GRAY,
          type: 'DEFAULT'
        });
      }
    }
  }

  // 2. Generate Edges Logic
  
  // A. Identify Neighbors (Physics based check is simplest and robust)
  const connectionThreshold = hexSize * 1.8; 
  interface PotentialEdge { s: string, t: string, l1: number, l2: number, dist: number }
  const potentials: PotentialEdge[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const n1 = nodes[i];
      const n2 = nodes[j];
      const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
      
      if (dist < connectionThreshold) {
        potentials.push({
            s: n1.id,
            t: n2.id,
            l1: nodeLayerMap.get(n1.id)!,
            l2: nodeLayerMap.get(n2.id)!,
            dist
        });
      }
    }
  }

  // B. Selection Rules
  // Rule 1: Outer Layer (Layer 3) Full Connectivity
  // Rule 2: Inter-layer (0-1, 1-2, 2-3) must have at least one connection.
  // Strategy: Randomly select subset (e.g. 40%), then patch to ensure rules.

  const selectedEdges = new Set<string>(); // Keep track to avoid dupes: "id1-id2" sorted
  const addEdge = (s: string, t: string) => {
      const key = s < t ? `${s}-${t}` : `${t}-${s}`;
      if (!selectedEdges.has(key)) {
          selectedEdges.add(key);
          edges.push({ source: s, target: t, type: 'PERMANENT' });
      }
  };

  const interLayerCandidates: Record<string, PotentialEdge[]> = {
      "0-1": [],
      "1-2": [],
      "2-3": []
  };

  for (const p of potentials) {
      const minL = Math.min(p.l1, p.l2);
      const maxL = Math.max(p.l1, p.l2);
      const isSameLayer = minL === maxL;
      
      // Store Inter-layer candidates for validation later
      if (!isSameLayer && maxL - minL === 1) {
          interLayerCandidates[`${minL}-${maxL}`].push(p);
      }

      // RULE 1: Outermost Ring is Fully Connected
      if (p.l1 === 3 && p.l2 === 3) {
          addEdge(p.s, p.t);
          continue;
      }

      // Random Selection for everything else
      // Adjust density: 40% chance
      if (Math.random() < 0.4) {
          addEdge(p.s, p.t);
      }
  }

  // C. Validate & Patch Inter-layer Connections (Rules 2 & 3)
  // Ensure "Every layer has at least one node connected to inner/outer"
  // This essentially means global connectivity between layers.
  
  ["0-1", "1-2", "2-3"].forEach(key => {
      const candidates = interLayerCandidates[key];
      // Check if we have ANY edge currently selected from this candidate list
      const hasConnection = candidates.some(p => {
          const k = p.s < p.t ? `${p.s}-${p.t}` : `${p.t}-${p.s}`;
          return selectedEdges.has(k);
      });

      if (!hasConnection && candidates.length > 0) {
          // Force add a random one
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          addEdge(pick.s, pick.t);
      }
  });

  // D. Connectivity Check (Bridge Islands)
  // Since we randomized, we might have isolated islands (especially in layer 2 or 1).
  // Simple Disjoint Set to connect everything
  const ds = new DisjointSet(nodes.length);
  const nodeIdToIndex = new Map(nodes.map((n, i) => [n.id, i]));
  
  edges.forEach(e => {
      ds.union(nodeIdToIndex.get(e.source)!, nodeIdToIndex.get(e.target)!);
  });

  // Iterate potentials again to bridge disconnected components
  // Prefer short connections (which all potentials are)
  for (const p of potentials) {
      const idx1 = nodeIdToIndex.get(p.s)!;
      const idx2 = nodeIdToIndex.get(p.t)!;
      if (!ds.connected(idx1, idx2)) {
          ds.union(idx1, idx2);
          addEdge(p.s, p.t);
      }
  }

  // 3. Assign Spawns Symmetrically
  const outerNodes = nodes.filter(n => nodeLayerMap.get(n.id) === 3);
  outerNodes.sort((a, b) => {
    const angA = Math.atan2(a.y - centerY, a.x - centerX);
    const angB = Math.atan2(b.y - centerY, b.x - centerX);
    return angA - angB;
  });

  const spawnIndices = [
    0,
    Math.floor(outerNodes.length * 0.25),
    Math.floor(outerNodes.length * 0.5),
    Math.floor(outerNodes.length * 0.75)
  ];

  const opponents = [PlayerColor.RED, PlayerColor.BLUE, PlayerColor.GREEN, PlayerColor.PURPLE]
     .filter(c => c !== playerColor)
     .slice(0, 3); 
  
  const activeColors = [playerColor, ...opponents];
  const occupiedIds = new Set<string>();

  activeColors.forEach((color, i) => {
    if (i < spawnIndices.length) {
       const targetNode = outerNodes[spawnIndices[i]];
       if (targetNode) {
          targetNode.owner = color;
          targetNode.prevOwner = color;
          targetNode.count = 30; 
          occupiedIds.add(targetNode.id);
       }
    }
  });

  // 4. Assign Special Node Types (Fortress & Hive)
  // Only assign to neutral nodes that are NOT the center (too OP) and NOT occupied
  const eligibleNeutrals = nodes.filter(n => 
    n.owner === PlayerColor.GRAY && 
    !occupiedIds.has(n.id) && 
    nodeLayerMap.get(n.id) !== 0
  );

  // Shuffle eligible neutrals
  for (let i = eligibleNeutrals.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligibleNeutrals[i], eligibleNeutrals[j]] = [eligibleNeutrals[j], eligibleNeutrals[i]];
  }

  // Assign 1-2 Fortress
  const fortressCount = 1 + Math.floor(Math.random() * 2); // 1 or 2
  let cursor = 0;
  
  for (let i=0; i<fortressCount; i++) {
      if (cursor < eligibleNeutrals.length) {
          eligibleNeutrals[cursor].type = 'FORTRESS';
          cursor++;
      }
  }

  // Assign 1-2 Hive
  const hiveCount = 1 + Math.floor(Math.random() * 2); // 1 or 2
  for (let i=0; i<hiveCount; i++) {
      if (cursor < eligibleNeutrals.length) {
          eligibleNeutrals[cursor].type = 'HIVE';
          cursor++;
      }
  }

  return { nodes, edges };
};

// --- Tutorial Map Generation ---

export const generateTutorialMap = (playerColor: PlayerColor): { nodes: Node[], edges: Edge[] } => {
    const nodes: Node[] = [];
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // 1. Define the "Story Nodes"
    const storyNodes: Node[] = [
        {
            id: 'tutorial-player',
            x: centerX - 180,
            y: centerY + 80,
            owner: playerColor,
            count: 40,
            capacity: MAX_CAPACITY_BASE,
            radius: NODE_RADIUS_BASE,
            growthAccumulator: 0,
            captureProgress: 1,
            prevOwner: playerColor,
            type: 'DEFAULT'
        },
        {
            id: 'tutorial-neutral',
            x: centerX,
            y: centerY - 120, // Top of the triangle
            owner: PlayerColor.GRAY,
            count: 10,
            capacity: MAX_CAPACITY_BASE,
            radius: NODE_RADIUS_BASE,
            growthAccumulator: 0,
            captureProgress: 1,
            prevOwner: PlayerColor.GRAY,
            type: 'DEFAULT'
        },
        {
            id: 'tutorial-enemy',
            x: centerX + 180,
            y: centerY + 80,
            owner: PlayerColor.RED === playerColor ? PlayerColor.BLUE : PlayerColor.RED,
            count: 40,
            capacity: MAX_CAPACITY_BASE,
            radius: NODE_RADIUS_BASE,
            growthAccumulator: 0,
            captureProgress: 1,
            prevOwner: PlayerColor.RED === playerColor ? PlayerColor.BLUE : PlayerColor.RED,
            type: 'DEFAULT'
        }
    ];

    nodes.push(...storyNodes);

    // 2. Generate "Background Nodes"
    const bgNodeCount = 21; 
    let currentAngle = 0;
    let currentRadius = 300; 

    for (let i = 0; i < bgNodeCount; i++) {
        const x = centerX + Math.cos(currentAngle) * currentRadius;
        const y = centerY + Math.sin(currentAngle) * currentRadius * 0.8; // Elliptical

        // Clamp to screen
        const clampedX = Math.max(60, Math.min(GAME_WIDTH - 60, x));
        const clampedY = Math.max(60, Math.min(GAME_HEIGHT - 60, y));

        nodes.push({
            id: `bg-node-${i}`,
            x: clampedX,
            y: clampedY,
            owner: PlayerColor.GRAY,
            count: 15 + (i % 5) * 5, // Deterministic count variation
            capacity: MAX_CAPACITY_BASE,
            radius: NODE_RADIUS_BASE,
            growthAccumulator: 0,
            captureProgress: 1,
            prevOwner: PlayerColor.GRAY,
            type: 'DEFAULT'
        });

        // Spiral out logic
        currentAngle += 0.8; 
        if (i % 8 === 0) currentRadius += 40; // Expand radius slowly
    }

    // 3. Generate Edges
    const edges: Edge[] = [];
    
    edges.push({ source: 'tutorial-player', target: 'tutorial-neutral', type: 'PERMANENT' });
    edges.push({ source: 'tutorial-neutral', target: 'tutorial-enemy', type: 'PERMANENT' });
    
    const allNodes = nodes;
    
    for (let i = 0; i < allNodes.length; i++) {
        for (let j = i + 1; j < allNodes.length; j++) {
            const n1 = allNodes[i];
            const n2 = allNodes[j];
            const d = Math.hypot(n1.x - n2.x, n1.y - n2.y);
            
            if (d < 180) {
                 if ((n1.id === 'tutorial-player' && n2.id === 'tutorial-enemy') || 
                     (n1.id === 'tutorial-enemy' && n2.id === 'tutorial-player')) {
                     continue;
                 }
                 
                 const exists = edges.some(e => 
                    (e.source === n1.id && e.target === n2.id) || 
                    (e.source === n2.id && e.target === n1.id)
                 );
                 
                 if (!exists) {
                    edges.push({ 
                        source: n1.id, 
                        target: n2.id, 
                        type: (i + j) % 3 === 0 ? 'PERMANENT' : 'RANDOM' 
                    });
                 }
            }
        }
    }

    return { nodes, edges };
};

// --- Shared Edge Logic ---

const generateEdgesForNodes = (nodes: Node[]): Edge[] => {
  const dist = (a: Node, b: Node) => Math.hypot(a.x - b.x, a.y - b.y);
  
  const potentialEdges: {s: number, t: number, d: number}[] = [];
  for(let i=0; i<nodes.length; i++) {
    for(let j=i+1; j<nodes.length; j++) {
      potentialEdges.push({ s: i, t: j, d: dist(nodes[i], nodes[j]) });
    }
  }
  potentialEdges.sort((a, b) => a.d - b.d);

  const edges: Edge[] = [];
  const ds = new DisjointSet(nodes.length);
  
  // A. Ensure Single Connected Component (MST)
  for (const edge of potentialEdges) {
    if (!ds.connected(edge.s, edge.t)) {
      ds.union(edge.s, edge.t);
      edges.push({ source: nodes[edge.s].id, target: nodes[edge.t].id, type: 'PERMANENT' });
    }
  }

  // B. Add 50% Extra Random Connections
  const extraEdgesNeeded = Math.floor(nodes.length * 0.5);
  let extraAdded = 0;

  for (const edge of potentialEdges) {
    if (extraAdded >= extraEdgesNeeded) break;
    
    const exists = edges.some(e => 
      (e.source === nodes[edge.s].id && e.target === nodes[edge.t].id) ||
      (e.source === nodes[edge.t].id && e.target === nodes[edge.s].id)
    );

    if (!exists) {
      if (edge.d < 400) { 
        edges.push({ source: nodes[edge.s].id, target: nodes[edge.t].id, type: 'RANDOM' });
        extraAdded++;
      }
    }
  }
  return edges;
}


// --- Topology Regeneration ---

export const regenerateTopology = (nodes: Node[], currentEdges: Edge[]): Edge[] => {
  const permanentEdges = currentEdges.filter(e => e.type === 'PERMANENT');
  
  const dist = (a: Node, b: Node) => Math.hypot(a.x - b.x, a.y - b.y);
  
  const potentialEdges: {s: number, t: number, d: number}[] = [];
  for(let i=0; i<nodes.length; i++) {
    for(let j=i+1; j<nodes.length; j++) {
      potentialEdges.push({ s: i, t: j, d: dist(nodes[i], nodes[j]) });
    }
  }
  potentialEdges.sort((a, b) => a.d - b.d);

  const newEdges = [...permanentEdges];
  const extraEdgesNeeded = Math.floor(nodes.length * 0.5);
  let extraAdded = 0;

  const validCandidates = potentialEdges.filter(e => e.d < 400);
  
  for (let i = validCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [validCandidates[i], validCandidates[j]] = [validCandidates[j], validCandidates[i]];
  }

  for (const edge of validCandidates) {
    if (extraAdded >= extraEdgesNeeded) break;

    const exists = newEdges.some(e => 
      (e.source === nodes[edge.s].id && e.target === nodes[edge.t].id) ||
      (e.source === nodes[edge.t].id && e.target === nodes[edge.s].id)
    );

    if (!exists) {
      newEdges.push({ source: nodes[edge.s].id, target: nodes[edge.t].id, type: 'RANDOM' });
      extraAdded++;
    }
  }

  return newEdges;
};

// --- Physics / Math Helpers ---

export const calculateGrowthIncrement = (count: number, baseGrowthPerTick: number): number => {
  if (count <= 1) return baseGrowthPerTick;
  const sizeBonus = Math.log10(count) * 0.5;
  return baseGrowthPerTick * (1 + sizeBonus);
};

export const calculateUnitSpeed = (nodeCount: number, baseSpeed: number): number => {
  if (nodeCount <= 1) return baseSpeed;
  const speedMultiplier = 1 + (Math.log(nodeCount) * 0.2);
  return baseSpeed * speedMultiplier;
};

export const calculateSpawnInterval = (count: number): number => {
  const safeCount = Math.max(1, count);
  const interval = BASE_SPAWN_INTERVAL_MS / (1 + Math.log(safeCount));
  return Math.max(40, interval);
};

// --- Helpers ---

class DisjointSet {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    if (this.parent[i] === i) return i;
    return this.parent[i] = this.find(this.parent[i]);
  }
  union(i: number, j: number) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) this.parent[rootI] = rootJ;
  }
  connected(i: number, j: number) {
    return this.find(i) === this.find(j);
  }
}

// --- AI Logic ---

export const calculateAIMoves = (
  world: GameWorld, 
  playerColor: PlayerColor, 
  difficulty: DifficultyLevel,
  isPlayerAutoPilot: boolean = false
): { from: string, to: string }[] => {
  const moves: { from: string, to: string }[] = [];
  const { nodes, edges } = world;
  const config = DIFFICULTY_SETTINGS[difficulty];

  const aiNodes = nodes.filter(n => 
    n.owner !== PlayerColor.GRAY && 
    (isPlayerAutoPilot || n.owner !== playerColor) && 
    PLAYABLE_COLORS.includes(n.owner)
  );
  
  const shuffledAiNodes = aiNodes.sort(() => 0.5 - Math.random());
  const actingNodes = shuffledAiNodes.slice(0, config.maxActionsPerTick === Infinity ? shuffledAiNodes.length : config.maxActionsPerTick);

  actingNodes.forEach(source => {
    if (Math.random() < config.hesitationChance) return;
    if (source.count < 10) return;

    const connectedIds = new Set<string>();
    edges.forEach(e => {
      if (e.source === source.id) connectedIds.add(e.target);
      if (e.target === source.id) connectedIds.add(e.source);
    });
    const neighbors = nodes.filter(n => connectedIds.has(n.id));

    let bestTarget: Node | null = null;
    let bestScore = -Infinity;
    const saturation = source.count / source.capacity; 

    neighbors.forEach(target => {
      let score = -Infinity;
      const isNeutral = target.owner === PlayerColor.GRAY;
      const isEnemy = target.owner !== source.owner && !isNeutral; 
      const isFriendly = target.owner === source.owner;

      if (isNeutral) {
        score = 100 - target.count; 
        if (saturation > 0.8) score += 50;
        
        // AI Logic: Prefer Hive or Fortress nodes slightly
        if (target.type === 'HIVE') score += 40;
        if (target.type === 'FORTRESS') score += 30;

      } else if (isEnemy) {
        const diff = source.count - target.count;
        
        // AI Logic: Fear Fortresses if not overwhelming
        if (target.type === 'FORTRESS') {
           // Effective HP is double, so effective difference is worse
           const effectiveEnemyCount = target.count * 2;
           const effectiveDiff = source.count - effectiveEnemyCount;
           if (effectiveDiff > 0) score = 30 + effectiveDiff;
           else score = -500; // Avoid unless huge advantage
        } else {
            if (saturation > 0.9) {
                score = 100 + (diff * 0.1);
            } else {
                if (diff > 0) score = 50 + diff;
                else score = diff > -10 ? -20 : -1000; 
            }
        }
        
      } else if (isFriendly) {
        if (target.count < 15) score = 50 + (15 - target.count);
        else if (target.count < target.capacity * 0.5) score = 10;
        else score = -50;
        
        if (saturation > 0.8 && (target.count / target.capacity) > 0.8) score = -200;
      }

      score += Math.random() * 20;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    });

    const threshold = saturation > 0.9 ? 10 : 30;
    if (bestTarget && bestScore > threshold) {
       if (bestScore > 50 || Math.random() > 0.3) {
         moves.push({ from: source.id, to: (bestTarget as Node).id });
       }
    }
  });

  return moves;
};
