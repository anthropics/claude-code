# MCP Hooks Usage Guide

This guide demonstrates how to use the MCP hooks to replace traditional React contexts and provide direct integration with MCP tools.

## Overview

The Claude Neural Framework now provides a set of React hooks that integrate directly with MCP tools. These hooks can replace traditional React contexts and provide a more consistent, efficient way to interact with MCP functionality.

## Available MCP Hooks

- `useMcpSequentialThinking`: For sequential thought generation
- `useMcpBraveSearch`: For web search capabilities
- `useMcpImageGeneration`: For image generation
- `useMcp21stDevMagic`: For UI component generation
- `useMcpRealTimeUpdates`: For real-time updates via WebSockets
- `useMcpContext7`: For document context, retrieval, and storage
- `useMcpGameState`: For game state management with persistence
- `useMcpDailyRewards`: For daily rewards management with persistence

For a comprehensive example that shows how to use multiple MCP hooks together, see the [Comprehensive MCP Hooks Integration Example](../examples/mcp_hooks_comprehensive_example.md).

## Demo Components

You can find example components that demonstrate the use of MCP hooks in the following files:

- `src/components/mcp/McpThinkingDemo.jsx`: Demonstrates sequential thinking
- `src/components/mcp/McpSearchDemo.jsx`: Demonstrates web search
- `src/components/mcp/McpImageDemo.jsx`: Demonstrates image generation
- `src/components/mcp/McpDashboard.jsx`: Integrates all demos into a single dashboard

## Migrating from Contexts to MCP Hooks

### From GameStateContext to useMcpGameState

#### Before:

```jsx
import React, { useContext } from 'react';
import { GameStateContext } from '../contexts/GameStateContext';

function GameComponent() {
  const { gameState, updateScore, levelUp } = useContext(GameStateContext);
  
  const handleScoreIncrease = () => {
    updateScore(100);
  };
  
  return (
    <div>
      <h2>Level: {gameState.level}</h2>
      <h3>Score: {gameState.score}</h3>
      <button onClick={handleScoreIncrease}>Add Score</button>
      <button onClick={levelUp}>Level Up</button>
    </div>
  );
}
```

#### After:

```jsx
import React from 'react';
import { useMcpGameState } from '../hooks/mcp';

function GameComponent() {
  const { gameState, isLoading, error, updateScore, levelUp } = useMcpGameState();
  
  const handleScoreIncrease = () => {
    updateScore(100);
  };
  
  if (isLoading) return <div>Loading game state...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!gameState) return <div>No game state available</div>;
  
  return (
    <div>
      <h2>Level: {gameState.level}</h2>
      <h3>Score: {gameState.score}</h3>
      <button onClick={handleScoreIncrease}>Add Score</button>
      <button onClick={levelUp}>Level Up</button>
    </div>
  );
}
```

### From DailyRewardsContext to useMcpDailyRewards

#### Before:

```jsx
import React, { useContext } from 'react';
import { DailyRewardsContext } from '../contexts/DailyRewardsContext';

function RewardsComponent() {
  const { rewards, todaysClaim, canClaimToday, claimDailyReward } = useContext(DailyRewardsContext);
  
  const handleClaim = () => {
    claimDailyReward();
  };
  
  return (
    <div>
      <h2>Daily Rewards</h2>
      <p>Current Streak: {rewards.streak}</p>
      
      {canClaimToday() ? (
        <button onClick={handleClaim}>Claim Today's Reward</button>
      ) : (
        <div>
          <p>Today's reward claimed:</p>
          <p>{todaysClaim.reward.type === 'points' ? 
            `${todaysClaim.reward.value} points` : 
            `${todaysClaim.reward.name}`}
          </p>
        </div>
      )}
    </div>
  );
}
```

#### After:

```jsx
import React from 'react';
import { useMcpDailyRewards } from '../hooks/mcp';

function RewardsComponent() {
  const { 
    rewards, 
    todaysClaim, 
    isLoading, 
    error,
    canClaimToday, 
    claimDailyReward 
  } = useMcpDailyRewards();
  
  const handleClaim = () => {
    claimDailyReward();
  };
  
  if (isLoading) return <div>Loading rewards...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!rewards) return <div>No rewards available</div>;
  
  return (
    <div>
      <h2>Daily Rewards</h2>
      <p>Current Streak: {rewards.streak}</p>
      
      {canClaimToday() ? (
        <button onClick={handleClaim}>Claim Today's Reward</button>
      ) : todaysClaim ? (
        <div>
          <p>Today's reward claimed:</p>
          <p>{todaysClaim.reward.type === 'points' ? 
            `${todaysClaim.reward.value} points` : 
            `${todaysClaim.reward.name}`}
          </p>
        </div>
      ) : (
        <p>No reward available today</p>
      )}
    </div>
  );
}
```

## Additional Benefits of MCP Hooks

### 1. Persistence

MCP hooks automatically persist state to the MCP memory system, so data is preserved across page refreshes and even browser sessions.

### 2. Consistency

All MCP hooks follow a consistent pattern with `isLoading` and `error` states, making it easier to handle loading and error states uniformly across your application.

### 3. Reduced Boilerplate

No need for Context providers wrapping your component tree - hooks can be used directly in any component that needs the functionality.

### 4. Better TypeScript Support

MCP hooks are fully typed, providing better IDE autocomplete and type checking than traditional Context API implementations.

### 5. Fallback Mechanisms

MCP hooks include fallback mechanisms for when MCP services are unavailable, ensuring your application works even if MCP services are down.

## Required Backend Integration

To support these hooks, your backend needs to implement the following API endpoints:

- `/api/mcp/memory/get`: Retrieve values from MCP memory
- `/api/mcp/memory/set`: Store values in MCP memory

These endpoints should connect to the MCP memory system or fallback to local storage when MCP is unavailable.