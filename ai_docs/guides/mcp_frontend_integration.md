# MCP Frontend Integration Guide

## Overview

This guide explains how the Claude Neural Framework integrates MCP (Model Context Protocol) tools with the frontend application using React hooks. The integration provides a clean, efficient way to access MCP capabilities directly from React components.

## Architecture

The integration architecture consists of the following components:

1. **MCP Hooks**: React hooks that provide direct access to MCP tools
2. **Memory Persistence Backend**: Express endpoints that handle state persistence through MCP
3. **Backward Compatibility Layer**: Context providers that use MCP hooks underneath for gradual migration

```
┌─────────────────┐       ┌───────────────────┐       ┌──────────────────┐
│   React         │       │  MCP Hooks        │       │ Memory           │
│   Components    │──────▶│  (useMcpGameState,│──────▶│ Persistence      │
│                 │       │   etc.)           │       │ Backend          │
└─────────────────┘       └───────────────────┘       └──────────────────┘
                                                                │
┌─────────────────┐       ┌───────────────────┐                │
│   Legacy        │       │  Compatibility    │                │
│   Components    │──────▶│  Context          │                │
│                 │       │  Providers        │                │
└─────────────────┘       └─────────┬─────────┘                │
                                    │                          │
                                    ▼                          ▼
                          ┌───────────────────────────────────────┐
                          │              MCP Services             │
                          └───────────────────────────────────────┘
```

## MCP Hooks

MCP hooks are custom React hooks that provide direct access to MCP tools. They follow a consistent pattern with loading states, error handling, and automatic persistence.

### Available Hooks

- `useMcpGameState`: Game state management with MCP persistence
- `useMcpDailyRewards`: Daily rewards management with MCP persistence
- `useMcpSequentialThinking`: Sequential thought generation (planned)
- `useMcpBraveSearch`: Web search capabilities (planned)
- `useMcpImageGeneration`: Image generation (planned)

### Usage Example

```jsx
import React from 'react';
import { useMcpGameState } from '../hooks/mcp';

function GameComponent() {
  const { 
    gameState, 
    isLoading, 
    error, 
    updateScore, 
    levelUp 
  } = useMcpGameState();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!gameState) return <div>No game state available</div>;
  
  return (
    <div>
      <h2>Level: {gameState.level}</h2>
      <h3>Score: {gameState.score}</h3>
      <button onClick={() => updateScore(100)}>Add Score</button>
      <button onClick={levelUp}>Level Up</button>
    </div>
  );
}
```

## Memory Persistence Backend

The memory persistence backend provides API endpoints for storing and retrieving data using MCP memory services. It includes fallback mechanisms for when MCP services are unavailable.

### API Endpoints

- `POST /api/mcp/memory/get`: Retrieve values from MCP memory
- `POST /api/mcp/memory/set`: Store values in MCP memory
- `POST /api/mcp/memory/delete`: Delete values from MCP memory
- `GET /api/mcp/memory/keys`: List all stored keys

### Server Configuration

The memory persistence server is automatically configured in the MCP configuration and started along with other MCP services.

## Backward Compatibility

To support gradual migration, the framework includes adapter components that maintain the old Context API interface but use MCP hooks underneath.

### Context Adapters

- `GameStateContext.jsx`: Adapter for the game state context
- `DailyRewardsContext.jsx`: Adapter for the daily rewards context

These adapters allow existing components to continue using the Context API while new components can use the MCP hooks directly.

## Migration Guide

To migrate from the old Context API to MCP hooks:

1. Identify components using the old Context API
2. Replace context imports with MCP hook imports
3. Replace `useContext` calls with MCP hook calls
4. Add loading and error state handling

See the [MCP Hooks Usage Guide](./mcp_hooks_usage.md) for detailed examples.

## Setup Instructions

1. Ensure the memory persistence server is configured in your MCP configuration
2. Start the MCP servers using the standard startup process
3. Use the MCP hooks in your React components
4. Test the integration using the provided test script

## Benefits

- **Reduced Boilerplate**: No need for Context providers wrapping your component tree
- **Automatic Persistence**: State is automatically persisted across page refreshes
- **Consistent Pattern**: All hooks follow the same pattern, making them easy to use
- **TypeScript Support**: Full TypeScript typing for better IDE integration
- **Fallback Mechanisms**: Graceful degradation when MCP services are unavailable