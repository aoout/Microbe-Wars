
import { forceSimulation, forceManyBody, forceCollide, forceX, forceY, SimulationNodeDatum } from 'd3-force';
import { Node, Edge, PlayerColor, GameWorld, DifficultyLevel } from '../types';
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
    growthAccumulator: 0 // Init accumulator
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
    nodes[nodeIdx].count = INITIAL_PLAYER_COUNT;
  });

  return { nodes, edges };
};

// --- Tutorial Map Generation ---

export const generateTutorialMap = (playerColor: PlayerColor): { nodes: Node[], edges: Edge[] } => {
    const nodes: Node[] = [];
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // 1. Define the "Story Nodes" (Fixed positions in the center in a triangle)
    // Positioned to be clearly visible but integrated into the map
    const storyNodes: Node[] = [
        {
            id: 'tutorial-player',
            x: centerX - 180,
            y: centerY + 80,
            owner: playerColor,
            count: 40,
            capacity: MAX_CAPACITY_BASE,
            radius: NODE_RADIUS_BASE,
            growthAccumulator: 0
        },
        {
            id: 'tutorial-neutral',
            x: centerX,
            y: centerY - 120, // Top of the triangle
            owner: PlayerColor.GRAY,
            count: 10,
            capacity: MAX_CAPACITY_BASE,
            radius: NODE_RADIUS_BASE,
            growthAccumulator: 0
        },
        {
            id: 'tutorial-enemy',
            x: centerX + 180,
            y: centerY + 80,
            owner: PlayerColor.RED === playerColor ? PlayerColor.BLUE : PlayerColor.RED,
            count: 40,
            capacity: MAX_CAPACITY_BASE,
            radius: NODE_RADIUS_BASE,
            growthAccumulator: 0
        }
    ];

    nodes.push(...storyNodes);

    // 2. Generate "Background Nodes" (Fixed Layout - Spiral)
    // This ensures the map looks "real" and dense (24 total nodes) but is identical every time.
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
            growthAccumulator: 0
        });

        // Spiral out logic
        currentAngle += 0.8; 
        if (i % 8 === 0) currentRadius += 40; // Expand radius slowly
    }

    // 3. Generate Edges
    // First, force the tutorial triangle connection (Permanent)
    const edges: Edge[] = [];
    
    // Player <-> Neutral
    edges.push({ source: 'tutorial-player', target: 'tutorial-neutral', type: 'PERMANENT' });
    // Neutral <-> Enemy
    edges.push({ source: 'tutorial-neutral', target: 'tutorial-enemy', type: 'PERMANENT' });
    
    // Connect background nodes to each other and loosely to the center to form a "Mesh"
    // We use a simple distance-based connector but deterministic-ish
    const allNodes = nodes;
    
    for (let i = 0; i < allNodes.length; i++) {
        for (let j = i + 1; j < allNodes.length; j++) {
            const n1 = allNodes[i];
            const n2 = allNodes[j];
            const d = Math.hypot(n1.x - n2.x, n1.y - n2.y);
            
            // Connect close nodes, but don't mess up the tutorial flow too much
            // Only add extra edges if they are reasonably close
            if (d < 180) {
                 // Avoid adding edges that short-circuit the tutorial path (Player -> Enemy direct)
                 if ((n1.id === 'tutorial-player' && n2.id === 'tutorial-enemy') || 
                     (n1.id === 'tutorial-enemy' && n2.id === 'tutorial-player')) {
                     continue;
                 }
                 
                 // Avoid duplicate edges
                 const exists = edges.some(e => 
                    (e.source === n1.id && e.target === n2.id) || 
                    (e.source === n2.id && e.target === n1.id)
                 );
                 
                 if (!exists) {
                    // Make most background edges random to show off the mechanic, some permanent
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
  // Sort by distance for MST construction (Kruskal's algorithm)
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

  // We iterate through potential edges again. 
  for (const edge of potentialEdges) {
    if (extraAdded >= extraEdgesNeeded) break;
    
    // Check if edge exists
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
  // 1. Keep Permanent Edges
  const permanentEdges = currentEdges.filter(e => e.type === 'PERMANENT');
  
  // 2. Generate Potential Edges again
  const dist = (a: Node, b: Node) => Math.hypot(a.x - b.x, a.y - b.y);
  
  const potentialEdges: {s: number, t: number, d: number}[] = [];
  for(let i=0; i<nodes.length; i++) {
    for(let j=i+1; j<nodes.length; j++) {
      potentialEdges.push({ s: i, t: j, d: dist(nodes[i], nodes[j]) });
    }
  }
  // Sort by distance to prioritize closer connections
  potentialEdges.sort((a, b) => a.d - b.d);

  const newEdges = [...permanentEdges];
  // Increase to 50%
  const extraEdgesNeeded = Math.floor(nodes.length * 0.5);
  let extraAdded = 0;

  // Add random edges, but shuffle the potential list slightly or just use a random selection mechanism
  // To make it truly "random" but still sane (not too far), we can filter by max distance then shuffle
  const validCandidates = potentialEdges.filter(e => e.d < 400);
  
  // Shuffle candidates
  for (let i = validCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [validCandidates[i], validCandidates[j]] = [validCandidates[j], validCandidates[i]];
  }

  for (const edge of validCandidates) {
    if (extraAdded >= extraEdgesNeeded) break;

    // Check if edge exists in permanent list
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

/**
 * Calculates how much a node should grow in a single tick.
 * Formula: Base + (Base * 0.5 * log10(Count))
 * Meaning: 10 units = 1.5x speed, 100 units = 2.0x speed.
 */
export const calculateGrowthIncrement = (count: number, baseGrowthPerTick: number): number => {
  if (count <= 1) return baseGrowthPerTick;
  
  // Log10 provides a nice slow curve.
  const sizeBonus = Math.log10(count) * 0.5;
  return baseGrowthPerTick * (1 + sizeBonus);
};

/**
 * Calculates the speed of a unit leaving a node.
 * Formula: Base * (1 + 0.2 * ln(Count))
 * Meaning: 10 units = ~1.46x speed, 100 units = ~1.92x speed.
 * @param baseSpeed - Can be fractional (0.01) or pixels per tick (e.g. 5)
 */
export const calculateUnitSpeed = (nodeCount: number, baseSpeed: number): number => {
  if (nodeCount <= 1) return baseSpeed;

  // Natural Log (Math.log) grows slightly faster initially than log10 but is standard for nature
  const speedMultiplier = 1 + (Math.log(nodeCount) * 0.2);
  return baseSpeed * speedMultiplier;
};

/**
 * Calculates the time interval between unit spawns.
 * Returns time in ms.
 * As count increases, interval decreases (diminishing returns).
 */
export const calculateSpawnInterval = (count: number): number => {
  // Prevent Infinity/NaN. Using log growth for rate means 1/(log) for interval.
  const safeCount = Math.max(1, count);
  
  // Formula: BASE / (1 + ln(count))
  // With Base 500:
  // Count 1: 500ms
  // Count 10: 151ms
  // Count 50: 102ms
  // Count 100: 89ms
  const interval = BASE_SPAWN_INTERVAL_MS / (1 + Math.log(safeCount));
  
  // Clamp to a minimum speed to prevent game engine overload or instant-drain
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

  // Identify all nodes controlled by AI 
  // If isPlayerAutoPilot is true, we include the player color in the AI calculation
  const aiNodes = nodes.filter(n => 
    n.owner !== PlayerColor.GRAY && 
    (isPlayerAutoPilot || n.owner !== playerColor) && 
    PLAYABLE_COLORS.includes(n.owner)
  );
  
  // Shuffle AI nodes to randomize action order slightly
  // This is crucial for lower difficulties: we only pick the first N nodes after shuffle to "simulate" limited attention
  const shuffledAiNodes = aiNodes.sort(() => 0.5 - Math.random());

  // LIMIT: Max Actions Per Tick (Attention Span)
  const actingNodes = shuffledAiNodes.slice(0, config.maxActionsPerTick === Infinity ? shuffledAiNodes.length : config.maxActionsPerTick);

  actingNodes.forEach(source => {
    // 0. Hesitation Check (Simulated human error/slowness)
    if (Math.random() < config.hesitationChance) return;

    // 1. Basic Check: Must have enough units to be effective
    if (source.count < 10) return;

    // 2. Identify Neighbors
    const connectedIds = new Set<string>();
    edges.forEach(e => {
      if (e.source === source.id) connectedIds.add(e.target);
      if (e.target === source.id) connectedIds.add(e.source);
    });
    const neighbors = nodes.filter(n => connectedIds.has(n.id));

    // 3. Score Targets
    let bestTarget: Node | null = null;
    let bestScore = -Infinity;

    // SATURATION PRESSURE
    // Even though nodes have infinite capacity, we treat the 'capacity' field as a "soft limit" or "ideal density".
    // If a node is saturated (> 100% capacity), it becomes highly aggressive to "vent" units.
    const saturation = source.count / source.capacity; 

    neighbors.forEach(target => {
      let score = -Infinity;
      
      const isNeutral = target.owner === PlayerColor.GRAY;
      const isEnemy = target.owner !== source.owner && !isNeutral; // Treats Player and other AI equally
      const isFriendly = target.owner === source.owner;

      if (isNeutral) {
        // High Priority: Expansion. Neutrals don't grow, so they are free real estate.
        // Prefer closer neutrals or ones with low count.
        score = 100 - target.count; 
        
        // If we are overflowing, any expansion is good expansion
        if (saturation > 0.8) {
           score += 50;
        }

      } else if (isEnemy) {
        // Combat Priority.
        const diff = source.count - target.count;
        
        // Base logic: Do we have more units?
        // Note: Infinite growth means enemies can be HUGE.
        
        if (saturation > 0.9) {
          // BERSERK MODE (Attrition Strategy)
          // If we are full, we MUST attack to utilize our production.
          // We flatten the penalty for attacking larger enemies.
          // score = Base Motivation (100) + Scaled Difference.
          // Example: AI(150) vs Enemy(1000). Diff = -850. Score = 100 - 85 = 15. (Positive!)
          score = 100 + (diff * 0.1);
        } else {
          // STANDARD MODE
          // Be careful. Only attack if we can win or nearly win.
          if (diff > 0) {
            score = 50 + diff; // Aggressive if winning
          } else {
            // If we are losing, avoid suicide... unless it's close (-10)
            score = diff > -10 ? -20 : -1000; 
          }
        }
        
      } else if (isFriendly) {
        // Support Priority.
        // Help friends who are low.
        if (target.count < 15) {
          score = 50 + (15 - target.count);
        } else if (target.count < target.capacity * 0.5) {
          score = 10; // Top up
        } else {
          score = -50; // Don't over-cluster units, spread them out
        }
        
        // Don't send units to an already saturated friend if we are also saturated
        if (saturation > 0.8 && (target.count / target.capacity) > 0.8) {
           score = -200;
        }
      }

      // Add a little randomness so AI isn't perfectly predictable
      score += Math.random() * 20;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    });

    // 4. Threshold for action
    // If we are saturated, we are desperate to act (lower threshold)
    const threshold = saturation > 0.9 ? 10 : 30;

    if (bestTarget && bestScore > threshold) {
       // Limit: Don't let every node attack every single tick if it's borderline.
       // But if score is high (easy kill), go for it.
       if (bestScore > 50 || Math.random() > 0.3) {
         moves.push({ from: source.id, to: (bestTarget as Node).id });
       }
    }
  });

  return moves;
};
