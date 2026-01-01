
import { GameWorld, PlayerColor, TravelPayload, ActiveTransfer, Node, DifficultyLevel, GameEvent, NodeType } from '../types';
import { 
  calculateGrowthIncrement, 
  calculateUnitSpeed, 
  calculateAIMoves, 
  regenerateTopology,
  calculateSpawnInterval
} from './gameLogic';
import { 
  TICK_RATE_MS, 
  GROWTH_INTERVAL_MS, 
  TRAVEL_SPEED_PIXELS, 
  DIFFICULTY_SETTINGS, 
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
  difficulty: DifficultyLevel;
  isPlayerAutoPilot: boolean;
  tutorialStep: number;
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
  // We recreate the events array every tick to ensure only new events are processed
  const currentEvents: GameEvent[] = [];
  let hasChanges = false;
  
  let updatedNextEventTime = ctx.nextEventTime;
  let updatedLastAITime = ctx.lastAITime;

  // 1. Ocean Current Event (Topology Change)
  // DISABLE IN TUTORIAL: Keep map static
  if (ctx.gameState !== 'TUTORIAL' && ctx.now >= ctx.nextEventTime) {
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

  // 2. Node Growth & Ink Spreading
  const baseGrowthPerTick = 1 / (GROWTH_INTERVAL_MS / TICK_RATE_MS); 
  const inkSpreadSpeed = 0.05; // 5% per tick, so ~1 second to fill

  newNodes = newNodes.map(n => {
    let updatedNode = { ...n };
    let nodeChanged = false;

    // A. Ink Spreading Animation Logic
    if (updatedNode.captureProgress < 1) {
       updatedNode.captureProgress = Math.min(1, updatedNode.captureProgress + inkSpreadSpeed);
       nodeChanged = true;
       hasChanges = true;
    }

    // B. Biological Growth
    // Neutrals don't grow
    if (updatedNode.owner !== PlayerColor.GRAY) {
      let growthIncrement = calculateGrowthIncrement(updatedNode.count, baseGrowthPerTick);
      
      // HIVE BONUS: +60% Growth Efficiency
      if (updatedNode.type === 'HIVE') {
          growthIncrement *= 1.6;
      }

      const newAccumulator = (updatedNode.growthAccumulator || 0) + growthIncrement;
      
      if (newAccumulator >= 1) {
        const wholeNumberGrowth = Math.floor(newAccumulator);
        updatedNode.count += wholeNumberGrowth;
        updatedNode.growthAccumulator = newAccumulator - wholeNumberGrowth;
        nodeChanged = true;
        hasChanges = true;
      } else {
        updatedNode.growthAccumulator = newAccumulator;
        nodeChanged = true; 
      }
    }
    
    return nodeChanged ? updatedNode : n;
  });

  // 3. Unit Spawning from Active Transfers
  const survivingTransfers: ActiveTransfer[] = [];
  newTransfers.forEach(t => {
    const sourceNodeIndex = newNodes.findIndex(n => n.id === t.sourceId);
    if (sourceNodeIndex === -1) return; 
    
    const sourceNode = newNodes[sourceNodeIndex];
    // Stop transfer if ownership changed
    if (sourceNode.owner !== t.owner) return; 

    // Dynamic Interval Logic
    const dynamicInterval = calculateSpawnInterval(sourceNode.count);

    // Time to spawn?
    if (ctx.now - t.lastSpawnTime > dynamicInterval) {
      // Logic for infinite vs fixed amount
      const canSpawn = (t.totalToSend === Infinity || t.sentCount < t.totalToSend) && sourceNode.count >= 1;
      
      if (canSpawn) {
        // Decrease source
        newNodes[sourceNodeIndex] = { ...sourceNode, count: sourceNode.count - 1 };
        
        // Calculate Absolute Speed
        const dx = t.endX - t.startX;
        const dy = t.endY - t.startY;
        const dist = Math.hypot(dx, dy);
        
        // Pixel speed per tick
        const speedPixels = calculateUnitSpeed(sourceNode.count, TRAVEL_SPEED_PIXELS);
        
        // Convert to progress (0-1) per tick: Speed / Distance
        // If distance is near zero (bug check), default to instantaneous or fast
        const progressIncrement = dist > 0 ? speedPixels / dist : 0.2;

        newPayloads.push({
          id: `p-${t.id}-${Date.now()}-${Math.random()}`,
          sourceId: t.sourceId,
          targetId: t.targetId,
          owner: t.owner,
          count: 1, 
          progress: 0,
          speed: progressIncrement,
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
  const aiInterval = DIFFICULTY_SETTINGS[ctx.difficulty].actionInterval;
  const isAIEnabled = ctx.gameState !== 'TUTORIAL';

  if (isAIEnabled && ctx.now - ctx.lastAITime > aiInterval) {
    const tempWorld = { 
      nodes: newNodes, 
      edges: newEdges, 
      payloads: newPayloads, 
      transfers: newTransfers,
      latestEvents: [] 
    };
    
    const moves = calculateAIMoves(tempWorld, ctx.playerColor, ctx.difficulty, ctx.isPlayerAutoPilot);
    
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

  // 5. Physics: Payload Movement & Collision
  const survivedPayloads: TravelPayload[] = [];
  const payloadsToRemove = new Set<string>();
  
  newPayloads.forEach(p => {
    p.progress += p.speed;
  });

  const edgeGroups = new Map<string, TravelPayload[]>();

  for (const p of newPayloads) {
    const key = p.sourceId < p.targetId 
      ? `${p.sourceId}-${p.targetId}` 
      : `${p.targetId}-${p.sourceId}`;
    
    if (!edgeGroups.has(key)) {
      edgeGroups.set(key, []);
    }
    edgeGroups.get(key)!.push(p);
  }

  for (const group of edgeGroups.values()) {
    if (group.length < 2) continue;
    const dx = group[0].endX - group[0].startX;
    const dy = group[0].endY - group[0].startY;
    const pathLength = Math.hypot(dx, dy);
    const collisionThreshold = pathLength > 0 ? 15 / pathLength : 0.05;

    for (let i = 0; i < group.length; i++) {
      if (payloadsToRemove.has(group[i].id)) continue;
      
      for (let j = i + 1; j < group.length; j++) {
        if (payloadsToRemove.has(group[j].id)) continue;

        const p1 = group[i];
        const p2 = group[j];
        
        if (p1.owner === p2.owner) continue;

        const movingOpposite = p1.sourceId !== p2.sourceId;
        
        if (movingOpposite) {
          const p1Pos = p1.progress;
          const p2Pos = 1 - p2.progress;
          const distProgress = Math.abs(p1Pos - p2Pos);
          
          if (distProgress < collisionThreshold) {
            payloadsToRemove.add(p1.id);
            payloadsToRemove.add(p2.id);
            hasChanges = true;
          }
        }
      }
    }
  }

  // 6. Arrival Logic (Impacts)
  const nodeUpdates = new Map<string, { count: number, owner: PlayerColor, prevOwner: PlayerColor, captureProgress: number, type: NodeType }>();
  
  const getLatestNodeState = (id: string) => {
    if (nodeUpdates.has(id)) return nodeUpdates.get(id)!;
    const n = newNodes.find(node => node.id === id)!;
    return { count: n.count, owner: n.owner, prevOwner: n.prevOwner || n.owner, captureProgress: n.captureProgress, type: n.type };
  };

  newPayloads.forEach(p => {
    if (payloadsToRemove.has(p.id)) return; 

    if (p.progress >= 1) {
      hasChanges = true;
      const target = newNodes.find(n => n.id === p.targetId);
      
      if (target) {
        const currentState = getLatestNodeState(target.id);
        
        // --- VISUAL EVENT GENERATION ---
        const dx = p.endX - p.startX;
        const dy = p.endY - p.startY;
        const angle = Math.atan2(dy, dx);
        
        const mass = Math.max(20, currentState.count);
        const force = Math.min(1.0, 30 / mass); 

        currentEvents.push({
            type: 'IMPACT',
            targetId: target.id,
            angle: angle,
            force: force,
            color: p.owner
        });

        // --- GAMEPLAY LOGIC ---

        if (currentState.owner === p.owner) {
          // Reinforcement
          nodeUpdates.set(target.id, { 
              ...currentState, 
              count: currentState.count + p.count 
          });
        } else {
          // Attack
          // FORTRESS BONUS: Incoming enemies do half damage (require 2 to kill 1)
          let incomingDamage = p.count;
          
          if (currentState.type === 'FORTRESS') {
              incomingDamage = incomingDamage * 0.5;
          }

          const result = currentState.count - incomingDamage;
          
          if (result < 0) {
            // Captured!
            nodeUpdates.set(target.id, { 
                count: Math.abs(result), 
                owner: p.owner,
                prevOwner: currentState.owner, // Store old owner for animation
                captureProgress: 0, // Reset animation
                type: currentState.type // Preserve type
            });
          } else {
            // Damaged
            nodeUpdates.set(target.id, { 
                ...currentState,
                count: result 
            });
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
        return { 
            ...n, 
            count: update.count, 
            owner: update.owner,
            prevOwner: update.prevOwner,
            captureProgress: update.captureProgress
        };
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
      transfers: newTransfers,
      latestEvents: currentEvents
    },
    lastAITime: updatedLastAITime,
    nextEventTime: updatedNextEventTime,
    hasChanges: hasChanges || edgesChanged || currentEvents.length > 0
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
