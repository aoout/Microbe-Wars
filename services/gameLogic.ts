import { forceSimulation, forceManyBody, forceCollide, forceX, forceY, SimulationNodeDatum } from 'd3-force';
import { Node, Edge, PlayerColor, GameWorld } from '../types';
import { GAME_WIDTH, GAME_HEIGHT, INITIAL_PLAYER_COUNT, NODE_RADIUS_BASE, PLAYABLE_COLORS, MAX_CAPACITY_BASE } from '../constants';

// --- Map Generation ---

interface SimNode extends SimulationNodeDatum {
  id: string;
  r: number;
  x?: number;
  y?: number;
}

export const generateMap = (playerColor: PlayerColor): { nodes: Node[], edges: Edge[] } => {
  // Requirement: 36-42 nodes
  const nodeCount = Math.floor(Math.random() * (42 - 36 + 1)) + 36;
  
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
  const ds = new DisjointSet(nodeCount);
  
  // A. Ensure Single Connected Component (MST)
  for (const edge of potentialEdges) {
    if (!ds.connected(edge.s, edge.t)) {
      ds.union(edge.s, edge.t);
      edges.push({ source: nodes[edge.s].id, target: nodes[edge.t].id, type: 'PERMANENT' });
    }
  }

  // B. Add 50% Extra Random Connections
  const extraEdgesNeeded = Math.floor(nodeCount * 0.5);
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
 */
export const calculateUnitSpeed = (nodeCount: number, baseSpeed: number): number => {
  if (nodeCount <= 1) return baseSpeed;

  // Natural Log (Math.log) grows slightly faster initially than log10 but is standard for nature
  const speedMultiplier = 1 + (Math.log(nodeCount) * 0.2);
  return baseSpeed * speedMultiplier;
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

export const calculateAIMoves = (world: GameWorld, playerColor: PlayerColor): { from: string, to: string }[] => {
  const moves: { from: string, to: string }[] = [];
  const { nodes, edges } = world;

  // Identify all nodes controlled by AI (Exclude GRAY and Exclude PLAYER)
  const aiNodes = nodes.filter(n => 
    n.owner !== PlayerColor.GRAY && 
    n.owner !== playerColor && 
    PLAYABLE_COLORS.includes(n.owner)
  );
  
  // Shuffle AI nodes to randomize action order slightly
  const shuffledAiNodes = aiNodes.sort(() => 0.5 - Math.random());

  shuffledAiNodes.forEach(source => {
    // 1. Basic Check: Must have enough units to be effective
    // Sending half means we need at least ~15 units to send a packet of ~7
    if (source.count < 15) return;

    // 2. Identify Neighbors
    const connectedIds = new Set<string>();
    edges.forEach(e => {
      if (e.source === source.id) connectedIds.add(e.target);
      if (e.target === source.id) connectedIds.add(e.source);
    });
    const neighbors = nodes.filter(n => connectedIds.has(n.id));

    // 3. Score Targets
    // We want to find the *best* target.
    let bestTarget: Node | null = null;
    let bestScore = -Infinity;

    neighbors.forEach(target => {
      let score = 0;
      
      const isNeutral = target.owner === PlayerColor.GRAY;
      const isEnemy = target.owner !== source.owner && !isNeutral;
      const isFriendly = target.owner === source.owner;

      if (isNeutral) {
        // High Priority: Expansion. Neutrals don't grow, so they are free real estate.
        // Prefer closer neutrals or ones with low count.
        score = 100 - target.count; 
      } else if (isEnemy) {
        // Combat Priority.
        // High score if we can overwhelm them.
        // Low score if we are sending units to die against a fortress.
        const diff = source.count - target.count;
        if (diff > 0) {
          score = 50 + diff; // Aggressive
        } else {
          score = -100; // Avoid suicide attacks unless desperate
        }
      } else if (isFriendly) {
        // Support Priority.
        // Help friends who are low.
        if (target.count < 15) {
          score = 20 + (15 - target.count);
        } else {
          score = -10; // Don't over-cluster units
        }
      }

      // Add a little randomness so AI isn't perfectly predictable
      score += Math.random() * 10;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    });

    // 4. Threshold for action
    // If the best move is terrible (negative score), do nothing and save units.
    if (bestTarget && bestScore > 0) {
       // Limit: Don't let every node attack every single tick if it's borderline.
       // But if score is high (easy kill), go for it.
       if (bestScore > 40 || Math.random() > 0.3) {
         moves.push({ from: source.id, to: (bestTarget as Node).id });
       }
    }
  });

  return moves;
};