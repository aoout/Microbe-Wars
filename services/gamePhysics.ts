import { GameWorld, PlayerColor, TravelPayload, ActiveTransfer, Node } from '../types';
import { 
  calculateGrowthIncrement, 
  calculateUnitSpeed, 
  calculateAIMoves, 
  regenerateTopology 
} from './gameLogic';
import { 
  TICK_RATE_MS, 
  GROWTH_INTERVAL_MS, 
  UNIT_SPAWN_INTERVAL_MS, 
  TRAVEL_SPEED, 
  AI_ACTION_INTERVAL, 
  OCEAN_CURRENT_INTERVAL_MS,
  PLAYABLE_COLORS
} from '../constants';

interface PhysicsContext {
  now: number;
  lastTickTime: number;
  lastAITime: number;
  nextEventTime: number;
  playerColor: PlayerColor;
  gameState: string;
}

interface PhysicsResult {
  world: GameWorld;
  lastAITime: number;
  nextEventTime: number;
  hasChanges: boolean;
}

export const advanceGameState = (
  currentWorld: GameWorld,
  ctx: PhysicsContext
): PhysicsResult => {
  let newNodes = [...currentWorld.nodes];
  let newEdges = currentWorld.edges;
  let newPayloads = [...currentWorld.payloads];
  let newTransfers = [...currentWorld.transfers];
  let hasChanges = false;
  
  let updatedNextEventTime = ctx.nextEventTime;
  let updatedLastAITime = ctx.lastAITime;

  // 1. Ocean Current Event (Topology Change)
  if (ctx.now >= ctx.nextEventTime) {
    newEdges = regenerateTopology(newNodes, newEdges);
    
    // Helper to check connectivity
    const isConnected = (sId: string, tId: string) => {
      return newEdges.some(e => 
        (e.source === sId && e.target === tId) || 
        (e.source === tId && e.target === sId)
      );
    };

    // Sever invalid connections
    newPayloads = newPayloads.filter(p => isConnected(p.sourceId, p.targetId));
    newTransfers = newTransfers.filter(t => isConnected(t.sourceId, t.targetId));

    updatedNextEventTime = ctx.now + OCEAN_CURRENT_INTERVAL_MS;
    hasChanges = true;
  }

  // 2. Node Growth
  const baseGrowthPerTick = 1 / (GROWTH_INTERVAL_MS / TICK_RATE_MS); 
  newNodes = newNodes.map(n => {
    // Neutrals don't grow, max capacity check
    if (n.owner !== PlayerColor.GRAY && n.count < n.capacity) {
      const growthIncrement = calculateGrowthIncrement(n.count, baseGrowthPerTick);
      const newAccumulator = (n.growthAccumulator || 0) + growthIncrement;
      
      if (newAccumulator >= 1) {
        const wholeNumberGrowth = Math.floor(newAccumulator);
        hasChanges = true;
        return { 
          ...n, 
          count: Math.min(n.capacity, n.count + wholeNumberGrowth), 
          growthAccumulator: newAccumulator - wholeNumberGrowth 
        };
      } else {
        return { ...n, growthAccumulator: newAccumulator };
      }
    }
    return n;
  });

  // 3. Unit Spawning from Active Transfers
  const survivingTransfers: ActiveTransfer[] = [];
  newTransfers.forEach(t => {
    const sourceNodeIndex = newNodes.findIndex(n => n.id === t.sourceId);
    if (sourceNodeIndex === -1) return; 
    
    const sourceNode = newNodes[sourceNodeIndex];
    // Stop transfer if ownership changed
    if (sourceNode.owner !== t.owner) return; 

    // Time to spawn?
    if (ctx.now - t.lastSpawnTime > UNIT_SPAWN_INTERVAL_MS) {
      // Logic for infinite vs fixed amount
      const canSpawn = (t.totalToSend === Infinity || t.sentCount < t.totalToSend) && sourceNode.count >= 1;
      
      if (canSpawn) {
        // Decrease source
        newNodes[sourceNodeIndex] = { ...sourceNode, count: sourceNode.count - 1 };
        
        // Create Payload
        const dynamicSpeed = calculateUnitSpeed(sourceNode.count, TRAVEL_SPEED);
        newPayloads.push({
          id: `p-${t.id}-${Date.now()}-${Math.random()}`,
          sourceId: t.sourceId,
          targetId: t.targetId,
          owner: t.owner,
          count: 1, 
          progress: 0,
          speed: dynamicSpeed,
          startX: t.startX,
          startY: t.startY,
          endX: t.endX,
          endY: t.endY
        });

        t.sentCount++;
        t.lastSpawnTime = ctx.now;
        hasChanges = true;
      }
    }

    // Keep transfer active if we still have units to send (or it's infinite) and source has units
    const stillActive = (t.totalToSend === Infinity || t.sentCount < t.totalToSend) && sourceNode.count >= 0; 
    if (stillActive) {
      survivingTransfers.push(t);
    }
  });
  newTransfers = survivingTransfers;

  // 4. AI Logic
  if (ctx.now - ctx.lastAITime > AI_ACTION_INTERVAL) {
    const tempWorld = { 
      nodes: newNodes, 
      edges: newEdges, 
      payloads: newPayloads, 
      transfers: newTransfers 
    };
    
    const moves = calculateAIMoves(tempWorld, ctx.playerColor);
    
    if (moves.length > 0) {
      moves.forEach(move => {
        const source = newNodes.find(n => n.id === move.from);
        const target = newNodes.find(n => n.id === move.to);
        if (source && target && source.count > 2) {
            const amount = Math.floor(source.count / 2);
            newTransfers.push({
              id: `ai-${Math.random()}`,
              sourceId: source.id,
              targetId: target.id,
              owner: source.owner,
              totalToSend: amount,
              sentCount: 0,
              lastSpawnTime: 0,
              startX: source.x,
              startY: source.y,
              endX: target.x,
              endY: target.y
            });
        }
      });
      hasChanges = true;
    }
    updatedLastAITime = ctx.now;
  }

  // 5. Physics: Payload Movement & Collision (OPTIMIZED)
  const survivedPayloads: TravelPayload[] = [];
  const payloadsToRemove = new Set<string>();
  
  // Step 5a: Move all payloads first
  newPayloads.forEach(p => {
    p.progress += p.speed;
  });

  // Step 5b: Spatial Partitioning for Collision
  // Group payloads by "Edge Key". An edge between A and B (regardless of direction) is the same collision space.
  const edgeGroups = new Map<string, TravelPayload[]>();

  for (const p of newPayloads) {
    // Determine a unique key for the edge regardless of direction A->B or B->A
    const key = p.sourceId < p.targetId 
      ? `${p.sourceId}-${p.targetId}` 
      : `${p.targetId}-${p.sourceId}`;
    
    if (!edgeGroups.has(key)) {
      edgeGroups.set(key, []);
    }
    edgeGroups.get(key)!.push(p);
  }

  // Iterate over groups instead of nested loop over all payloads
  // Reduces complexity from O(Total^2) to roughly O(Edges * (AvgPayloadsPerEdge^2))
  for (const group of edgeGroups.values()) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      if (payloadsToRemove.has(group[i].id)) continue;
      
      for (let j = i + 1; j < group.length; j++) {
        if (payloadsToRemove.has(group[j].id)) continue;

        const p1 = group[i];
        const p2 = group[j];
        
        // Optimization: Only check different owners
        if (p1.owner === p2.owner) continue;

        // Collision logic:
        // p1 and p2 must be moving in opposite directions to collide head-on in this 1D space.
        // If they are moving same direction, they are just chasing, no collision (unless we add overtaking logic).
        const movingOpposite = p1.sourceId !== p2.sourceId;
        
        if (movingOpposite) {
          // Normalize positions to 0..1 from the perspective of p1's source
          // p1 is at p1.progress
          // p2 is at p2.progress from ITS source, which is p1's target.
          // So p2's position relative to p1's source is (1 - p2.progress).
          
          const p1Pos = p1.progress;
          const p2Pos = 1 - p2.progress;
          const dist = Math.abs(p1Pos - p2Pos);
          
          // Collision threshold
          if (dist < 0.05) {
            payloadsToRemove.add(p1.id);
            payloadsToRemove.add(p2.id);
            hasChanges = true;
          }
        }
      }
    }
  }

  // 6. Arrival Logic
  const nodeUpdates = new Map<string, { count: number, owner: PlayerColor }>();
  
  const getLatestNodeState = (id: string) => {
    if (nodeUpdates.has(id)) return nodeUpdates.get(id)!;
    const n = newNodes.find(node => node.id === id)!;
    return { count: n.count, owner: n.owner };
  };

  newPayloads.forEach(p => {
    if (payloadsToRemove.has(p.id)) return; 

    if (p.progress >= 1) {
      hasChanges = true;
      const target = newNodes.find(n => n.id === p.targetId);
      
      if (target) {
        const { count, owner } = getLatestNodeState(target.id);

        if (owner === p.owner) {
          nodeUpdates.set(target.id, { count: count + p.count, owner });
        } else {
          const result = count - p.count;
          if (result < 0) {
            nodeUpdates.set(target.id, { count: Math.abs(result), owner: p.owner });
          } else {
            nodeUpdates.set(target.id, { count: result, owner });
          }
        }
      }
    } else {
      survivedPayloads.push(p);
    }
  });

  if (nodeUpdates.size > 0) {
    newNodes = newNodes.map(n => {
      if (nodeUpdates.has(n.id)) {
        const update = nodeUpdates.get(n.id)!;
        return { ...n, count: update.count, owner: update.owner };
      }
      return n;
    });
  }

  const edgesChanged = newEdges !== currentWorld.edges;

  return {
    world: {
      nodes: newNodes,
      edges: newEdges,
      payloads: survivedPayloads,
      transfers: newTransfers
    },
    lastAITime: updatedLastAITime,
    nextEventTime: updatedNextEventTime,
    hasChanges: hasChanges || edgesChanged
  };
};

export const checkWinCondition = (world: GameWorld, playerColor: PlayerColor): { winner: PlayerColor | null, isGameOver: boolean } => {
  const playerNodes = world.nodes.filter(n => n.owner === playerColor).length;
  const enemyNodes = world.nodes.filter(n => n.owner !== playerColor && n.owner !== PlayerColor.GRAY).length;
  const playerAssets = playerNodes + world.payloads.filter(p => p.owner === playerColor).length + world.transfers.filter(t => t.owner === playerColor).length;

  if (enemyNodes === 0 && playerNodes > 0) {
    return { winner: playerColor, isGameOver: true };
  } else if (playerAssets === 0) {
    return { winner: null, isGameOver: true }; 
  }
  
  return { winner: null, isGameOver: false };
};