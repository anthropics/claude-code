import React, { createContext } from 'react';
import { useMcpGameState } from "./hooks/mcp";

// This is an adapter for backwards compatibility
// It provides the same API as the original GameStateContext
// but uses the MCP hooks underneath

const GameStateContext = createContext(null);

export const GameStateProvider = ({ children }) => {
  const gameState = useMcpGameState();
  
  return (
    <GameStateContext.Provider value={gameState}>
      {children}
    </GameStateContext.Provider>
  );
};

export { GameStateContext };
