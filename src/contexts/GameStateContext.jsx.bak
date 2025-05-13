import React, { createContext, useContext, useState, useEffect } from 'react';

// Initial game state
const initialGameState = {
  currentDay: 1,
  lastLoginTimestamp: null,
  lastDailyRewardClaim: null,
  currentStreak: 0,
  resources: 100,
  xp: 0,
  level: 1,
  skillPoints: 0,
  techPoints: 0,
  reputation: 0,
  inventory: []
};

// Create context
const GameStateContext = createContext();

// Provider component
export const GameStateProvider = ({ children }) => {
  // Load game state from localStorage or use initial state
  const [gameState, setGameState] = useState(() => {
    try {
      const savedState = localStorage.getItem('agentland_gameState');
      return savedState ? JSON.parse(savedState) : initialGameState;
    } catch (error) {
      console.error('Failed to load game state from localStorage:', error);
      return initialGameState;
    }
  });

  // Save game state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('agentland_gameState', JSON.stringify(gameState));
    } catch (error) {
      console.error('Failed to save game state to localStorage:', error);
    }
  }, [gameState]);

  // Function to update game state
  const updateGameState = (newState) => {
    setGameState(prevState => ({
      ...prevState,
      ...newState
    }));
  };

  // Function to reset game state
  const resetGameState = () => {
    setGameState(initialGameState);
  };

  // Context value
  const contextValue = {
    gameState,
    updateGameState,
    resetGameState
  };

  return (
    <GameStateContext.Provider value={contextValue}>
      {children}
    </GameStateContext.Provider>
  );
};

// Custom hook for using the game state context
export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
};

export default GameStateContext;