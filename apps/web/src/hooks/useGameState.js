import { useContext } from 'react';
import GameStateContext from "./contexts/GameStateContext";

/**
 * Custom hook for accessing and manipulating game state
 * @returns {Object} Game state and related functions
 */
export const useGameState = () => {
  const context = useContext(GameStateContext);
  
  if (!context) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  
  return context;
};