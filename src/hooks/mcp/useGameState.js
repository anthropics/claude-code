import { useState, useEffect } from 'react';

/**
 * MCP-integrated game state hook
 * 
 * This hook provides game state management with MCP persistence,
 * replacing the previous GameStateContext implementation.
 */
export function useMcpGameState() {
  const [gameState, setGameState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load game state on mount
  useEffect(() => {
    const loadGameState = async () => {
      try {
        setIsLoading(true);
        
        // Try to load from MCP memory
        const response = await fetch('/api/mcp/memory/get', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ key: 'game_state' })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.value) {
            setGameState(data.value);
          } else {
            // Initialize default state if no saved state exists
            setGameState({
              level: 1,
              score: 0,
              inventory: [],
              lastUpdated: new Date().toISOString()
            });
          }
        } else {
          throw new Error('Failed to load game state');
        }
      } catch (err) {
        console.error('Error loading game state:', err);
        setError('Failed to load game state');
        
        // Fallback to default state
        setGameState({
          level: 1,
          score: 0,
          inventory: [],
          lastUpdated: new Date().toISOString()
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadGameState();
  }, []);

  // Save game state
  const saveGameState = async (newState) => {
    try {
      const updatedState = {
        ...newState,
        lastUpdated: new Date().toISOString()
      };
      
      // Update local state
      setGameState(updatedState);
      
      // Save to MCP memory
      const response = await fetch('/api/mcp/memory/set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          key: 'game_state',
          value: updatedState,
          ttl: 86400 * 30 // 30 days
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save game state');
      }
      
      return true;
    } catch (err) {
      console.error('Error saving game state:', err);
      setError('Failed to save game state');
      return false;
    }
  };

  // Update score
  const updateScore = async (points) => {
    if (!gameState) return false;
    
    const newScore = gameState.score + points;
    const newState = { ...gameState, score: newScore };
    
    return await saveGameState(newState);
  };

  // Level up
  const levelUp = async () => {
    if (!gameState) return false;
    
    const newLevel = gameState.level + 1;
    const newState = { ...gameState, level: newLevel };
    
    return await saveGameState(newState);
  };

  // Add to inventory
  const addToInventory = async (item) => {
    if (!gameState) return false;
    
    const newInventory = [...gameState.inventory, item];
    const newState = { ...gameState, inventory: newInventory };
    
    return await saveGameState(newState);
  };

  // Reset game state
  const resetGameState = async () => {
    const defaultState = {
      level: 1,
      score: 0,
      inventory: [],
      lastUpdated: new Date().toISOString()
    };
    
    return await saveGameState(defaultState);
  };

  return {
    gameState,
    isLoading,
    error,
    updateScore,
    levelUp,
    addToInventory,
    resetGameState,
    saveGameState
  };
}

export default useMcpGameState;