import { useState, useRef, useEffect, useCallback } from 'react';
import { GameState, GameWorld, PlayerColor, ActiveTransfer } from '../types';
import { generateMap } from '../services/gameLogic';
import { advanceGameState, checkWinCondition } from '../services/gamePhysics';
import { TICK_RATE_MS, OCEAN_CURRENT_INTERVAL_MS } from '../constants';

export const useGameEngine = () => {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [playerColor, setPlayerColor] = useState<PlayerColor>(PlayerColor.BLUE);
  const [winner, setWinner] = useState<PlayerColor | null>(null);
  
  // We use a ref for the world state to avoid closure staleness in the game loop
  // and to allow high-frequency updates without re-rendering every single frame if we chose to throttle.
  // However, for this game, we sync state every frame for smooth animation.
  const worldRef = useRef<GameWorld>({ nodes: [], edges: [], payloads: [], transfers: [] });
  const [renderWorld, setRenderWorld] = useState<GameWorld>(worldRef.current);
  
  // Timing Refs
  const lastTickTimeRef = useRef<number>(0);
  const lastAITimeRef = useRef<number>(0);
  const nextEventTimeRef = useRef<number>(0);
  const requestRef = useRef<number>(0);

  // Expose next event time for UI (throttled update could be better, but we pass the ref value via state mostly)
  const [nextCurrentTime, setNextCurrentTime] = useState<number>(0);

  const startGame = useCallback(() => {
    const { nodes, edges } = generateMap(playerColor);
    const initialWorld = { nodes, edges, payloads: [], transfers: [] };
    
    worldRef.current = initialWorld;
    setRenderWorld(initialWorld);
    
    setGameState('PLAYING');
    setWinner(null);
    
    const now = Date.now();
    lastTickTimeRef.current = now;
    lastAITimeRef.current = now;
    nextEventTimeRef.current = now + OCEAN_CURRENT_INTERVAL_MS;
    setNextCurrentTime(nextEventTimeRef.current);
  }, [playerColor]);

  const resetGame = useCallback(() => {
    setGameState('MENU');
  }, []);

  const handleAttack = useCallback((fromId: string, toId: string, isContinuous: boolean) => {
    if (gameState !== 'PLAYING') return;

    const world = worldRef.current;
    const source = world.nodes.find(n => n.id === fromId);
    const target = world.nodes.find(n => n.id === toId);

    if (!source || !target) return;
    if (source.owner !== playerColor) return;

    const amountToSend = isContinuous ? Infinity : Math.floor(source.count / 2);
    if (amountToSend < 1) return;

    const newTransfer: ActiveTransfer = {
      id: `trans-${Date.now()}-${Math.random()}`,
      sourceId: source.id,
      targetId: target.id,
      owner: source.owner,
      totalToSend: amountToSend,
      sentCount: 0,
      lastSpawnTime: 0,
      startX: source.x,
      startY: source.y,
      endX: target.x,
      endY: target.y
    };

    // Mutate Ref directly for immediate responsiveness in next tick
    worldRef.current = {
      ...world,
      transfers: [...world.transfers, newTransfer]
    };
    // We don't necessarily need to setRenderWorld here, the loop will pick it up next frame (approx 16ms)
  }, [gameState, playerColor]);

  const gameLoop = useCallback(() => {
    requestRef.current = requestAnimationFrame(gameLoop);

    if (gameState !== 'PLAYING') return;

    const now = Date.now();
    if (now - lastTickTimeRef.current < TICK_RATE_MS) return;

    // Physics Update
    const { world, lastAITime, nextEventTime, hasChanges } = advanceGameState(
      worldRef.current,
      {
        now,
        lastTickTime: lastTickTimeRef.current,
        lastAITime: lastAITimeRef.current,
        nextEventTime: nextEventTimeRef.current,
        playerColor: playerColor,
        gameState
      }
    );

    // Check Win/Loss
    const status = checkWinCondition(world, playerColor);
    if (status.isGameOver) {
      setGameState(status.winner ? 'VICTORY' : 'DEFEAT');
      setWinner(status.winner);
    }

    // Update Refs
    worldRef.current = world;
    lastTickTimeRef.current = now;
    lastAITimeRef.current = lastAITime;
    
    // Sync UI if event time changed heavily (or just keep it in sync for the timer)
    if (nextEventTime !== nextEventTimeRef.current) {
        nextEventTimeRef.current = nextEventTime;
        setNextCurrentTime(nextEventTime);
    }

    // Update React State for Render
    if (hasChanges) {
      setRenderWorld(world);
    }

  }, [gameState, playerColor]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameLoop]);

  return {
    gameState,
    setGameState, // exposed for manual overrides if needed
    world: renderWorld,
    playerColor,
    setPlayerColor,
    winner,
    nextCurrentTime,
    startGame,
    resetGame,
    handleAttack
  };
};