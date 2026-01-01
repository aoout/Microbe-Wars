
import React from 'react';
import { useGameEngine } from './hooks/useGameEngine';
import GameMap from './components/game/GameMap';
import StatsWidget from './components/game/StatsWidget';
import MainMenu from './components/screens/MainMenu';
import GameOverScreen from './components/screens/GameOverScreen';
import TutorialOverlay from './components/ui/TutorialOverlay';

const App: React.FC = () => {
  const {
    gameState,
    world,
    playerColor,
    setPlayerColor,
    difficulty,
    setDifficulty,
    gameMode,
    setGameMode,
    nextCurrentTime,
    startGame,
    resetGame,
    handleAttack,
    isPlayerAutoPilot,
    toggleAutoPilot,
    togglePause,
    skipTutorial,
    tutorialStep,
    nextTutorialStep,
    hasCompletedTutorial
  } = useGameEngine();

  return (
    <div className="w-full h-screen flex flex-col font-sans overflow-hidden relative selection:bg-blue-500/30">
      
      {/* 1. Main Menu */}
      {gameState === 'MENU' && (
        <MainMenu 
          playerColor={playerColor}
          setPlayerColor={setPlayerColor}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          gameMode={gameMode}
          setGameMode={setGameMode}
          startGame={startGame}
          hasCompletedTutorial={hasCompletedTutorial}
        />
      )}

      {/* 2. Tutorial Overlay */}
      {gameState === 'TUTORIAL' && tutorialStep && (
        <TutorialOverlay 
          step={tutorialStep}
          nextStep={nextTutorialStep}
          skipTutorial={skipTutorial}
        />
      )}

      {/* 3. Game Over Screen */}
      {(gameState === 'VICTORY' || gameState === 'DEFEAT') && (
        <GameOverScreen 
          gameState={gameState}
          world={world}
          playerColor={playerColor}
          difficulty={difficulty}
          resetGame={resetGame}
        />
      )}

      {/* 4. Main Game Area */}
      <div className="flex-1 relative z-0">
         {(world.nodes.length > 0) && (
           <>
             <GameMap 
               world={world} 
               playerColor={playerColor} 
               onAttack={handleAttack}
               nextCurrentTime={nextCurrentTime}
               isAutoPilot={isPlayerAutoPilot}
               onToggleAutoPilot={toggleAutoPilot}
               isPaused={gameState === 'PAUSED'}
               onTogglePause={togglePause}
               tutorialTargetId={gameState === 'TUTORIAL' ? tutorialStep?.targetNodeId : undefined}
               onTutorialClick={nextTutorialStep}
             />
             
             {/* Stats Widget */}
             {(gameState === 'PLAYING' || gameState === 'TUTORIAL') && (
                <StatsWidget world={world} />
             )}
           </>
         )}
      </div>

    </div>
  );
};

export default App;
