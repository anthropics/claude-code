import React, { createContext } from 'react';
import { useMcpDailyRewards } from "./hooks/mcp";

// This is an adapter for backwards compatibility
// It provides the same API as the original DailyRewardsContext
// but uses the MCP hooks underneath

const DailyRewardsContext = createContext(null);

export const DailyRewardsProvider = ({ children }) => {
  const rewards = useMcpDailyRewards();
  
  return (
    <DailyRewardsContext.Provider value={rewards}>
      {children}
    </DailyRewardsContext.Provider>
  );
};

export { DailyRewardsContext };
