import { useState, useRef, useEffect, useCallback } from 'react';
import { GameState, GameWorld, PlayerColor, ActiveTransfer, DifficultyLevel, TutorialStep } from '../types';
import { generateMap, generateTutorialMap } from '../services/gameLogic';
import { advanceGameState, checkWinCondition } from '../services/gamePhysics';
import { TICK_RATE_MS, OCEAN_CURRENT_INTERVAL_MS } from '../constants';

// Define Tutorial Steps
const TUTORIAL_STEPS: TutorialStep[] = [
    { 
      id: 0, 
      text: "指挥官，系统已上线。当前环境：培养皿 Alpha。未激活的背景节点已过滤。专注执行核心指令。", 
      requiredAction: 'NEXT' 
    },
    { 
      id: 1, 
      text: "指令一：建立突触链接。点击选中你的 **母体群落** (蓝色节点)。", 
      requiredAction: 'SELECT', 
      targetNodeId: 'tutorial-player' 
    },
    { 
      id: 2, 
      text: "我们需要生物质来增殖。点击上方的 **中立群落** (灰色)，派遣孢子进行感染。", 
      requiredAction: 'ATTACK', 
      targetNodeId: 'tutorial-neutral' 
    },
    { 
      id: 3, 
      text: "孢子正在突破细胞壁。等待群落完成 **同化**。中立目标是极佳的初期资源。", 
      requiredAction: 'CAPTURE', 
      targetNodeId: 'tutorial-neutral' 
    },
    { 
      id: 4, 
      text: "【生长算法】群落越大，细胞分裂速率越高。尽早扩张以获得指数级资源优势。", 
      requiredAction: 'NEXT' 
    },
    { 
      id: 5, 
      text: "【环境警告】培养基极不稳定。注意图中的 **虚线连接**。每 60 秒，洋流会随机重组这些路径。", 
      requiredAction: 'NEXT' 
    },
    { 
      id: 6, 
      text: "只有 **实线连接** 是永久固定的神经突触。利用它们构建不可动摇的防线。", 
      requiredAction: 'NEXT' 
    },
    { 
      id: 7, 
      text: "【高级战术】按住 **[Ctrl] + 点击** (或长按拖拽) 目标，建立 **持续输送流**。尝试建立补给线。", 
      requiredAction: 'STREAM', 
      targetNodeId: 'tutorial-neutral' 
    },
    { 
      id: 8, 
      text: "高危警报：侦测到敌对红色菌株！运用你所学的一切战术，**彻底根除它**。", 
      requiredAction: 'WIN', 
      targetNodeId: 'tutorial-enemy' 
    }
];

export const useGameEngine = () => {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [playerColor, setPlayerColor] = useState<PlayerColor>(PlayerColor.BLUE);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(3);
  const [winner, setWinner] = useState<PlayerColor | null>(null);
  const [isPlayerAutoPilot, setIsPlayerAutoPilot] = useState(false);
  
  // Tutorial State
  const [tutorialStep, setTutorialStep] = useState<number>(0);
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState<boolean>(false);

  const worldRef = useRef<GameWorld>({ nodes: [], edges: [], payloads: [], transfers: [], latestEvents: [] });
  const [renderWorld, setRenderWorld] = useState<GameWorld>(worldRef.current);
  
  // Timing Refs
  const lastTickTimeRef = useRef<number>(0);
  const lastAITimeRef = useRef<number>(0);
  const nextEventTimeRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number>(0); // Track when pause started
  const requestRef = useRef<number>(0);

  const [nextCurrentTime, setNextCurrentTime] = useState<number>(0);

  // Load persistence
  useEffect(() => {
    const done = localStorage.getItem('microbio_tutorial_completed');
    if (done === 'true') setHasCompletedTutorial(true);
  }, []);

  const startGame = useCallback((forceTutorial = false) => {
    const shouldRunTutorial = forceTutorial;

    let initialWorld;
    if (shouldRunTutorial) {
        setGameState('TUTORIAL');
        setTutorialStep(0);
        // Force Player Blue in Tutorial for simplicity with text
        setPlayerColor(PlayerColor.BLUE); 
        const { nodes, edges } = generateTutorialMap(PlayerColor.BLUE);
        initialWorld = { nodes, edges, payloads: [], transfers: [], latestEvents: [] };
    } else {
        setGameState('PLAYING');
        const { nodes, edges } = generateMap(playerColor);
        initialWorld = { nodes, edges, payloads: [], transfers: [], latestEvents: [] };
    }
    
    worldRef.current = initialWorld;
    setRenderWorld(initialWorld);
    setWinner(null);
    setIsPlayerAutoPilot(false);
    
    const now = Date.now();
    lastTickTimeRef.current = now;
    lastAITimeRef.current = now;
    nextEventTimeRef.current = now + OCEAN_CURRENT_INTERVAL_MS;
    setNextCurrentTime(nextEventTimeRef.current);
  }, [playerColor, hasCompletedTutorial]);

  const resetGame = useCallback(() => {
    setGameState('MENU');
  }, []);

  // New function to skip tutorial
  const skipTutorial = useCallback(() => {
    localStorage.setItem('microbio_tutorial_completed', 'true');
    setHasCompletedTutorial(true);
    setGameState('MENU');
  }, []);

  const toggleAutoPilot = useCallback(() => {
    setIsPlayerAutoPilot(prev => !prev);
  }, []);

  const togglePause = useCallback(() => {
    if (gameState === 'PLAYING') {
      setGameState('PAUSED');
      pauseStartTimeRef.current = Date.now();
    } else if (gameState === 'PAUSED') {
      const now = Date.now();
      const duration = now - pauseStartTimeRef.current;
      
      // Shift all time-based references forward by the duration of the pause
      // This prevents the game from "catching up" instantly (e.g., immediate ocean current shift)
      lastTickTimeRef.current += duration;
      lastAITimeRef.current += duration;
      nextEventTimeRef.current += duration;
      
      // Update the exposed state for the timer UI
      setNextCurrentTime(nextEventTimeRef.current);

      // Shift individual transfer timers so they don't dump all units at once
      const newTransfers = worldRef.current.transfers.map(t => ({
        ...t,
        lastSpawnTime: t.lastSpawnTime + duration
      }));
      
      worldRef.current = {
        ...worldRef.current,
        transfers: newTransfers
      };
      
      // Sync render state
      setRenderWorld(worldRef.current);

      setGameState('PLAYING');
    }
  }, [gameState]);

  const handleAttack = useCallback((fromId: string, toId: string, isContinuous: boolean) => {
    if (gameState !== 'PLAYING' && gameState !== 'TUTORIAL') return;

    // Tutorial checks
    if (gameState === 'TUTORIAL') {
        const currentTask = TUTORIAL_STEPS[tutorialStep];
        
        // Block actions if selecting wrong things (optional, but good for guiding)
        if (currentTask.requiredAction === 'SELECT' && fromId !== 'tutorial-player') return;
        
        // Advance step logic for Attack/Stream actions
        if (currentTask.id === 2 && fromId === 'tutorial-player' && toId === 'tutorial-neutral') {
             setTutorialStep(3);
        }
        if (currentTask.id === 7 && isContinuous) {
             setTutorialStep(8);
        }
    }

    const world = worldRef.current;
    const source = world.nodes.find(n => n.id === fromId);
    const target = world.nodes.find(n => n.id === toId);

    if (!source || !target) return;
    if (source.owner !== playerColor) return;

    const amountToSend = isContinuous ? Infinity : Math.floor(source.count / 2);
    if (amountToSend < 1) return;

    // Check if a transfer already exists
    const existingTransferIndex = world.transfers.findIndex(t => 
      t.sourceId === fromId && t.targetId === toId
    );

    let newTransfers = [...world.transfers];

    if (existingTransferIndex !== -1) {
      const existing = newTransfers[existingTransferIndex];
      let newTotalToSend = existing.totalToSend;

      if (isContinuous) {
        newTotalToSend = Infinity;
      } else {
        if (existing.totalToSend !== Infinity) {
          newTotalToSend = existing.totalToSend + amountToSend;
        }
      }

      newTransfers[existingTransferIndex] = {
        ...existing,
        totalToSend: newTotalToSend
      };

    } else {
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
      newTransfers.push(newTransfer);
    }

    worldRef.current = {
      ...world,
      transfers: newTransfers
    };
  }, [gameState, playerColor, tutorialStep]);

  // Special function to advance simple click-through tutorial steps
  const nextTutorialStep = useCallback(() => {
     if (gameState === 'TUTORIAL') {
        const current = TUTORIAL_STEPS[tutorialStep];
        if (current.requiredAction === 'NEXT' || current.requiredAction === 'SELECT') {
           if (tutorialStep < TUTORIAL_STEPS.length - 1) {
              setTutorialStep(prev => prev + 1);
           }
        }
     }
  }, [gameState, tutorialStep]);

  // Check passive tutorial conditions
  const checkTutorialConditions = (world: GameWorld) => {
      if (gameState !== 'TUTORIAL') return;
      
      const currentTask = TUTORIAL_STEPS[tutorialStep];
      
      // Step 3: Capture Neutral
      if (currentTask.id === 3) {
          const neutral = world.nodes.find(n => n.id === 'tutorial-neutral');
          if (neutral && neutral.owner === PlayerColor.BLUE) {
              setTutorialStep(4);
          }
      }
      
      // Step 8: Win (Capture Enemy)
      if (currentTask.id === 8) {
          const enemy = world.nodes.find(n => n.id === 'tutorial-enemy');
          if (enemy && enemy.owner === PlayerColor.BLUE) {
              // Tutorial Complete
              localStorage.setItem('microbio_tutorial_completed', 'true');
              setHasCompletedTutorial(true);
              setWinner(PlayerColor.BLUE);
              setGameState('VICTORY');
          }
      }
  };

  const gameLoop = useCallback(() => {
    requestRef.current = requestAnimationFrame(gameLoop);

    if (gameState !== 'PLAYING' && gameState !== 'TUTORIAL') return;

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
        gameState,
        difficulty,
        isPlayerAutoPilot,
        tutorialStep: tutorialStep // Pass step ID for AI control logic
      }
    );

    // Tutorial Specific Checks
    if (gameState === 'TUTORIAL') {
        checkTutorialConditions(world);
    } 
    // Normal Win Check (Only if not in tutorial, or let tutorial logic handle victory)
    else {
        const status = checkWinCondition(world, playerColor);
        if (status.isGameOver) {
            setGameState(status.winner ? 'VICTORY' : 'DEFEAT');
            setWinner(status.winner);
        }
    }

    worldRef.current = world;
    lastTickTimeRef.current = now;
    lastAITimeRef.current = lastAITime;
    
    if (nextEventTime !== nextEventTimeRef.current) {
        nextEventTimeRef.current = nextEventTime;
        setNextCurrentTime(nextEventTime);
    }

    if (hasChanges) {
      setRenderWorld(world);
    }

  }, [gameState, playerColor, difficulty, isPlayerAutoPilot, tutorialStep]); 

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameLoop]);

  return {
    gameState,
    setGameState,
    world: renderWorld,
    playerColor,
    setPlayerColor,
    difficulty,
    setDifficulty,
    winner,
    nextCurrentTime,
    startGame,
    resetGame,
    handleAttack,
    isPlayerAutoPilot,
    toggleAutoPilot,
    togglePause,
    skipTutorial, // Export updated function
    tutorialStep: gameState === 'TUTORIAL' ? TUTORIAL_STEPS[tutorialStep] : null,
    nextTutorialStep,
    hasCompletedTutorial
  };
};