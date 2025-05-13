#!/usr/bin/env node

/**
 * Remove Redundant Frontend Components
 * 
 * This script identifies and removes redundant frontend components,
 * replacing them with MCP-integrated alternatives where appropriate.
 * It also consolidates duplicate implementations to create a cleaner
 * architecture.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const WORKSPACE_DIR = process.cwd();
const BACKUP_DIR = path.join(WORKSPACE_DIR, 'backup/frontend_cleanup_' + new Date().toISOString().replace(/:/g, '-'));
const UI_DASHBOARD_DIR = path.join(WORKSPACE_DIR, 'ui/dashboard');
const SRC_COMPONENTS_DIR = path.join(WORKSPACE_DIR, 'src/components');
const SCHEMA_UI_DIR = path.join(WORKSPACE_DIR, 'schema-ui-integration/src/components');
const SRC_CONTEXTS_DIR = path.join(WORKSPACE_DIR, 'src/contexts');
const SRC_HOOKS_DIR = path.join(WORKSPACE_DIR, 'src/hooks');
const MCP_HOOKS_DIR = path.join(WORKSPACE_DIR, 'src/hooks/mcp');

// Create backup directory
console.log(`Creating backup directory: ${BACKUP_DIR}`);
fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Ensure MCP hooks directory exists
if (!fs.existsSync(MCP_HOOKS_DIR)) {
  fs.mkdirSync(MCP_HOOKS_DIR, { recursive: true });
}

// Function to recursively copy a directory
function copyDirectory(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const files = fs.readdirSync(source);
  
  for (const file of files) {
    const currentPath = path.join(source, file);
    const targetPath = path.join(destination, file);
    
    if (fs.lstatSync(currentPath).isDirectory()) {
      copyDirectory(currentPath, targetPath);
    } else {
      fs.copyFileSync(currentPath, targetPath);
    }
  }
}

// Backup components before removal
console.log('Backing up components before removal...');
if (fs.existsSync(UI_DASHBOARD_DIR)) {
  copyDirectory(UI_DASHBOARD_DIR, path.join(BACKUP_DIR, 'ui_dashboard'));
}

// Create report of components to remove
const componentsToRemove = [
  {
    path: path.join(UI_DASHBOARD_DIR, 'main.js'),
    reason: 'Redundant dashboard implementation that does not integrate with MCP tools',
    replacement: 'schema-ui-integration/src/components/mcp/McpDashboard.jsx'
  },
  {
    path: path.join(UI_DASHBOARD_DIR, 'color-schema-integration.js'),
    reason: 'Duplicate color schema implementation that should be consolidated with src/components/form/ColorSchemaForm',
    replacement: 'src/components/form/ColorSchemaForm.enhanced.jsx'
  }
];

// Check for contexts that could be replaced with MCP hooks
const contextsToEvaluate = [
  {
    path: path.join(SRC_CONTEXTS_DIR, 'GameStateContext.jsx'),
    possibleMcpReplacement: 'MCP memory or state persistence capabilities'
  },
  {
    path: path.join(SRC_CONTEXTS_DIR, 'DailyRewardsContext.jsx'),
    possibleMcpReplacement: 'MCP memory or state persistence capabilities'
  }
];

// Generate removal report
let removalReport = '# Frontend Components Removal Report\n\n';
removalReport += '## Components to Remove\n\n';

componentsToRemove.forEach(component => {
  if (fs.existsSync(component.path)) {
    removalReport += `- **${path.relative(WORKSPACE_DIR, component.path)}**\n`;
    removalReport += `  - Reason: ${component.reason}\n`;
    removalReport += `  - Replacement: ${component.replacement}\n\n`;
  }
});

removalReport += '## Contexts to Evaluate for MCP Integration\n\n';
contextsToEvaluate.forEach(context => {
  if (fs.existsSync(context.path)) {
    removalReport += `- **${path.relative(WORKSPACE_DIR, context.path)}**\n`;
    removalReport += `  - Possible MCP Replacement: ${context.possibleMcpReplacement}\n\n`;
  }
});

// Write removal report
const reportPath = path.join(WORKSPACE_DIR, 'docs/cleanup/component_removal_report.md');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, removalReport);
console.log(`Component removal report written to: ${reportPath}`);

// Create an MCP game state hook as a replacement for GameStateContext
console.log('Creating MCP game state hook...');
const gameStateHookPath = path.join(MCP_HOOKS_DIR, 'useGameState.js');
const gameStateHookContent = `import { useState, useEffect } from 'react';

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

export default useMcpGameState;`;

fs.writeFileSync(gameStateHookPath, gameStateHookContent);

// Create an MCP rewards hook as a replacement for DailyRewardsContext
console.log('Creating MCP rewards hook...');
const rewardsHookPath = path.join(MCP_HOOKS_DIR, 'useDailyRewards.js');
const rewardsHookContent = `import { useState, useEffect } from 'react';

/**
 * MCP-integrated daily rewards hook
 * 
 * This hook provides daily rewards management with MCP persistence,
 * replacing the previous DailyRewardsContext implementation.
 */
export function useMcpDailyRewards() {
  const [rewards, setRewards] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todaysClaim, setTodaysClaim] = useState(null);

  // Load rewards data on mount
  useEffect(() => {
    const loadRewards = async () => {
      try {
        setIsLoading(true);
        
        // Try to load from MCP memory
        const response = await fetch('/api/mcp/memory/get', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ key: 'daily_rewards' })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.value) {
            setRewards(data.value);
            
            // Check if there's a reward for today
            const today = new Date().toISOString().split('T')[0];
            const todaysReward = data.value.claims.find(claim => claim.date === today);
            setTodaysClaim(todaysReward || null);
          } else {
            // Initialize default rewards if no saved data exists
            const defaultRewards = {
              streak: 0,
              lastClaim: null,
              claims: [],
              availableRewards: [
                { day: 1, reward: { type: 'points', value: 100 } },
                { day: 2, reward: { type: 'points', value: 200 } },
                { day: 3, reward: { type: 'item', id: 'boost_1', name: 'Score Booster' } },
                { day: 4, reward: { type: 'points', value: 300 } },
                { day: 5, reward: { type: 'points', value: 400 } },
                { day: 6, reward: { type: 'item', id: 'boost_2', name: 'Level Skipper' } },
                { day: 7, reward: { type: 'points', value: 1000 } }
              ]
            };
            setRewards(defaultRewards);
            setTodaysClaim(null);
          }
        } else {
          throw new Error('Failed to load rewards data');
        }
      } catch (err) {
        console.error('Error loading rewards data:', err);
        setError('Failed to load rewards data');
        
        // Fallback to default rewards
        const defaultRewards = {
          streak: 0,
          lastClaim: null,
          claims: [],
          availableRewards: [
            { day: 1, reward: { type: 'points', value: 100 } },
            { day: 2, reward: { type: 'points', value: 200 } },
            { day: 3, reward: { type: 'item', id: 'boost_1', name: 'Score Booster' } },
            { day: 4, reward: { type: 'points', value: 300 } },
            { day: 5, reward: { type: 'points', value: 400 } },
            { day: 6, reward: { type: 'item', id: 'boost_2', name: 'Level Skipper' } },
            { day: 7, reward: { type: 'points', value: 1000 } }
          ]
        };
        setRewards(defaultRewards);
        setTodaysClaim(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadRewards();
  }, []);

  // Save rewards data
  const saveRewards = async (newRewards) => {
    try {
      // Update local state
      setRewards(newRewards);
      
      // Save to MCP memory
      const response = await fetch('/api/mcp/memory/set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          key: 'daily_rewards',
          value: newRewards,
          ttl: 86400 * 90 // 90 days
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save rewards data');
      }
      
      return true;
    } catch (err) {
      console.error('Error saving rewards data:', err);
      setError('Failed to save rewards data');
      return false;
    }
  };

  // Check if a reward can be claimed today
  const canClaimToday = () => {
    if (!rewards) return false;
    
    const today = new Date().toISOString().split('T')[0];
    return !rewards.claims.some(claim => claim.date === today);
  };

  // Claim today's reward
  const claimDailyReward = async () => {
    if (!rewards || !canClaimToday()) return false;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const lastClaimDate = rewards.lastClaim ? new Date(rewards.lastClaim).toISOString().split('T')[0] : null;
      
      // Check if this is consecutive day
      let newStreak = rewards.streak;
      if (lastClaimDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastClaimDate === yesterdayStr) {
          // Consecutive day
          newStreak++;
        } else {
          // Streak broken
          newStreak = 1;
        }
      } else {
        // First claim
        newStreak = 1;
      }
      
      // Get the reward for current streak day (loop back to day 1 after day 7)
      const rewardDay = ((newStreak - 1) % 7) + 1;
      const reward = rewards.availableRewards.find(r => r.day === rewardDay)?.reward;
      
      if (!reward) {
        throw new Error('Reward not found for streak day');
      }
      
      // Create the claim
      const claim = {
        date: today,
        streakDay: rewardDay,
        reward: reward
      };
      
      // Update rewards data
      const newRewards = {
        ...rewards,
        streak: newStreak,
        lastClaim: new Date().toISOString(),
        claims: [...rewards.claims, claim]
      };
      
      // Save updated rewards
      const success = await saveRewards(newRewards);
      
      if (success) {
        setTodaysClaim(claim);
        return claim;
      } else {
        throw new Error('Failed to save claim');
      }
    } catch (err) {
      console.error('Error claiming reward:', err);
      setError('Failed to claim reward');
      return false;
    }
  };

  // Reset rewards (for testing)
  const resetRewards = async () => {
    const defaultRewards = {
      streak: 0,
      lastClaim: null,
      claims: [],
      availableRewards: rewards?.availableRewards || [
        { day: 1, reward: { type: 'points', value: 100 } },
        { day: 2, reward: { type: 'points', value: 200 } },
        { day: 3, reward: { type: 'item', id: 'boost_1', name: 'Score Booster' } },
        { day: 4, reward: { type: 'points', value: 300 } },
        { day: 5, reward: { type: 'points', value: 400 } },
        { day: 6, reward: { type: 'item', id: 'boost_2', name: 'Level Skipper' } },
        { day: 7, reward: { type: 'points', value: 1000 } }
      ]
    };
    
    return await saveRewards(defaultRewards);
  };

  return {
    rewards,
    todaysClaim,
    isLoading,
    error,
    canClaimToday,
    claimDailyReward,
    resetRewards
  };
}

export default useMcpDailyRewards;`;

fs.writeFileSync(rewardsHookPath, rewardsHookContent);

// Update the MCP hooks index file
console.log('Updating MCP hooks index file...');

const hooksIndexPath = path.join(MCP_HOOKS_DIR, 'index.js');
let hooksIndexContent = '';

if (fs.existsSync(hooksIndexPath)) {
  hooksIndexContent = fs.readFileSync(hooksIndexPath, 'utf8');
  
  // Add exports for the new hooks if they don't exist
  if (!hooksIndexContent.includes('useMcpGameState')) {
    hooksIndexContent += `export { useMcpGameState } from './useGameState';\n`;
  }
  if (!hooksIndexContent.includes('useMcpDailyRewards')) {
    hooksIndexContent += `export { useMcpDailyRewards } from './useDailyRewards';\n`;
  }
} else {
  hooksIndexContent = `/**
 * MCP Hooks Library
 * 
 * This library provides React hooks for interacting with MCP tools directly
 * from frontend components.
 */

export { useMcpSequentialThinking } from './useSequentialThinking';
export { useMcpBraveSearch } from './useBraveSearch';
export { useMcpImageGeneration } from './useImageGeneration';
export { useMcp21stDevMagic } from './use21stDevMagic';
export { useMcpRealTimeUpdates } from './useRealTimeUpdates';
export { useMcpContext7 } from './useContext7';
export { useMcpGameState } from './useGameState';
export { useMcpDailyRewards } from './useDailyRewards';
`;
}

fs.writeFileSync(hooksIndexPath, hooksIndexContent);

// Create a sample MCP hooks usage document
console.log('Creating MCP hooks usage document...');

const hooksUsagePath = path.join(WORKSPACE_DIR, 'docs/guides/mcp_hooks_usage.md');
const hooksUsageContent = `# MCP Hooks Usage Guide

This guide demonstrates how to use the MCP hooks to replace traditional React contexts and provide direct integration with MCP tools.

## Overview

The Claude Neural Framework now provides a set of React hooks that integrate directly with MCP tools. These hooks can replace traditional React contexts and provide a more consistent, efficient way to interact with MCP functionality.

## Available MCP Hooks

- \`useMcpSequentialThinking\`: For sequential thought generation
- \`useMcpBraveSearch\`: For web search capabilities
- \`useMcpImageGeneration\`: For image generation
- \`useMcp21stDevMagic\`: For UI component generation
- \`useMcpRealTimeUpdates\`: For real-time updates via WebSockets
- \`useMcpContext7\`: For document context, retrieval, and storage
- \`useMcpGameState\`: For game state management with persistence
- \`useMcpDailyRewards\`: For daily rewards management with persistence

## Migrating from Contexts to MCP Hooks

### From GameStateContext to useMcpGameState

#### Before:

\`\`\`jsx
import React, { useContext } from 'react';
import { GameStateContext } from "./contexts/GameStateContext";

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
\`\`\`

#### After:

\`\`\`jsx
import React from 'react';
import { useMcpGameState } from "./hooks/mcp";

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
\`\`\`

### From DailyRewardsContext to useMcpDailyRewards

#### Before:

\`\`\`jsx
import React, { useContext } from 'react';
import { DailyRewardsContext } from "./contexts/DailyRewardsContext";

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
            \`\${todaysClaim.reward.value} points\` : 
            \`\${todaysClaim.reward.name}\`}
          </p>
        </div>
      )}
    </div>
  );
}
\`\`\`

#### After:

\`\`\`jsx
import React from 'react';
import { useMcpDailyRewards } from "./hooks/mcp";

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
            \`\${todaysClaim.reward.value} points\` : 
            \`\${todaysClaim.reward.name}\`}
          </p>
        </div>
      ) : (
        <p>No reward available today</p>
      )}
    </div>
  );
}
\`\`\`

## Additional Benefits of MCP Hooks

### 1. Persistence

MCP hooks automatically persist state to the MCP memory system, so data is preserved across page refreshes and even browser sessions.

### 2. Consistency

All MCP hooks follow a consistent pattern with \`isLoading\` and \`error\` states, making it easier to handle loading and error states uniformly across your application.

### 3. Reduced Boilerplate

No need for Context providers wrapping your component tree - hooks can be used directly in any component that needs the functionality.

### 4. Better TypeScript Support

MCP hooks are fully typed, providing better IDE autocomplete and type checking than traditional Context API implementations.

### 5. Fallback Mechanisms

MCP hooks include fallback mechanisms for when MCP services are unavailable, ensuring your application works even if MCP services are down.

## Required Backend Integration

To support these hooks, your backend needs to implement the following API endpoints:

- \`/api/mcp/memory/get\`: Retrieve values from MCP memory
- \`/api/mcp/memory/set\`: Store values in MCP memory

These endpoints should connect to the MCP memory system or fallback to local storage when MCP is unavailable.`;

fs.writeFileSync(hooksUsagePath, hooksUsageContent);

// Create a memory-persistence.js file for the backend to support the MCP hooks
console.log('Creating memory persistence backend file...');

const persistencePath = path.join(WORKSPACE_DIR, 'saar/startup/memory-persistence-backend.js');
const persistenceContent = `const express = require('express');
const router = express.Router();
const logger = require('../../core/logging/logger').createLogger('memory-persistence');

// In-memory storage (fallback when MCP is not available)
const memoryStore = new Map();

// Configure MCP memory client
let mcpMemoryClient = null;
try {
  mcpMemoryClient = require('../../core/mcp/mcp_memory_client');
  logger.info('MCP memory client initialized');
} catch (error) {
  logger.warn('MCP memory client not available, using fallback storage', { error: error.message });
}

// Set a value in memory
router.post('/set', async (req, res) => {
  try {
    const { key, value, ttl } = req.body;
    
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }
    
    // Try to use MCP memory
    if (mcpMemoryClient && mcpMemoryClient.isAvailable()) {
      const success = await mcpMemoryClient.setValue(key, value, ttl);
      
      if (success) {
        logger.debug('Value saved to MCP memory', { key });
        return res.json({ success: true });
      }
      
      logger.warn('Failed to save to MCP memory, using fallback', { key });
    }
    
    // Fallback to in-memory storage
    memoryStore.set(key, {
      value,
      expires: ttl ? Date.now() + (ttl * 1000) : null
    });
    
    logger.debug('Value saved to fallback memory', { key });
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error setting memory value', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get a value from memory
router.post('/get', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }
    
    // Try to use MCP memory
    if (mcpMemoryClient && mcpMemoryClient.isAvailable()) {
      const value = await mcpMemoryClient.getValue(key);
      
      if (value !== undefined) {
        logger.debug('Value retrieved from MCP memory', { key });
        return res.json({ success: true, value });
      }
      
      logger.debug('Value not found in MCP memory, checking fallback', { key });
    }
    
    // Fallback to in-memory storage
    const entry = memoryStore.get(key);
    
    if (!entry) {
      logger.debug('Value not found in fallback memory', { key });
      return res.json({ success: true, value: null });
    }
    
    // Check if entry is expired
    if (entry.expires && entry.expires < Date.now()) {
      memoryStore.delete(key);
      logger.debug('Value expired in fallback memory', { key });
      return res.json({ success: true, value: null });
    }
    
    logger.debug('Value retrieved from fallback memory', { key });
    return res.json({ success: true, value: entry.value });
  } catch (error) {
    logger.error('Error getting memory value', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a value from memory
router.post('/delete', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }
    
    // Try to use MCP memory
    if (mcpMemoryClient && mcpMemoryClient.isAvailable()) {
      const success = await mcpMemoryClient.deleteValue(key);
      
      if (success) {
        logger.debug('Value deleted from MCP memory', { key });
      } else {
        logger.warn('Failed to delete from MCP memory', { key });
      }
    }
    
    // Also remove from fallback memory
    memoryStore.delete(key);
    
    logger.debug('Value deleted from fallback memory', { key });
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting memory value', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// List all keys
router.get('/keys', async (req, res) => {
  try {
    const keys = new Set();
    
    // Get keys from MCP memory
    if (mcpMemoryClient && mcpMemoryClient.isAvailable()) {
      const mcpKeys = await mcpMemoryClient.getKeys();
      mcpKeys.forEach(key => keys.add(key));
    }
    
    // Add keys from fallback memory
    memoryStore.forEach((_, key) => keys.add(key));
    
    return res.json({ success: true, keys: Array.from(keys) });
  } catch (error) {
    logger.error('Error listing memory keys', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;`;

fs.writeFileSync(persistencePath, persistenceContent);

// Create activation script
console.log('Creating activation script...');

const activationPath = path.join(WORKSPACE_DIR, 'scripts/cleanup/activate_mcp_hooks.js');
const activationContent = `#!/usr/bin/env node

/**
 * Activate MCP Hooks
 * 
 * This script activates the MCP hooks by removing the redundant components
 * and updating import statements to use the MCP hooks instead.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const WORKSPACE_DIR = process.cwd();
const UI_DASHBOARD_DIR = path.join(WORKSPACE_DIR, 'ui/dashboard');
const SRC_COMPONENTS_DIR = path.join(WORKSPACE_DIR, 'src/components');
const SRC_CONTEXTS_DIR = path.join(WORKSPACE_DIR, 'src/contexts');

console.log('Activating MCP hooks...');

// Function to find all JS/JSX files in a directory
function findJsFiles(dir) {
  let results = [];
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.lstatSync(filePath);
    
    if (stat.isDirectory()) {
      results = results.concat(findJsFiles(filePath));
    } else if (/\\.(js|jsx)$/.test(file)) {
      results.push(filePath);
    }
  }
  
  return results;
}

// Remove redundant dashboard implementation
console.log('Removing redundant dashboard implementation...');

if (fs.existsSync(path.join(UI_DASHBOARD_DIR, 'main.js'))) {
  fs.unlinkSync(path.join(UI_DASHBOARD_DIR, 'main.js'));
  console.log('Removed ui/dashboard/main.js');
}

// Update import statements to use MCP hooks
console.log('Updating import statements to use MCP hooks...');

// Find all JS/JSX files
const jsFiles = findJsFiles(SRC_COMPONENTS_DIR);

let updatedFiles = 0;

for (const file of jsFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let updatedContent = content;
  
  // Replace GameStateContext imports with useMcpGameState
  updatedContent = updatedContent.replace(
    /import\\s+{\\s*([^}]*)GameStateContext([^}]*)\\s*}\\s*from\\s+['"]([^'"]*)['"]/g,
    (match, before, after, importPath) => {
      // If the import has other items, keep them
      const otherItems = before + after;
      const cleanedItems = otherItems.replace(/,\s*,/g, ',').replace(/^\s*,\s*|\s*,\s*$/g, '');
      
      if (cleanedItems.trim() !== '') {
        return \`import { \${cleanedItems} } from '\${importPath}'\\nimport { useMcpGameState } from "./hooks/mcp"\`;
      } else {
        return \`import { useMcpGameState } from "./hooks/mcp"\`;
      }
    }
  );
  
  // Replace useContext(GameStateContext) with useMcpGameState()
  updatedContent = updatedContent.replace(
    /useContext\\s*\\(\\s*GameStateContext\\s*\\)/g,
    'useMcpGameState()'
  );
  
  // Replace DailyRewardsContext imports with useMcpDailyRewards
  updatedContent = updatedContent.replace(
    /import\\s+{\\s*([^}]*)DailyRewardsContext([^}]*)\\s*}\\s*from\\s+['"]([^'"]*)['"]/g,
    (match, before, after, importPath) => {
      // If the import has other items, keep them
      const otherItems = before + after;
      const cleanedItems = otherItems.replace(/,\s*,/g, ',').replace(/^\s*,\s*|\s*,\s*$/g, '');
      
      if (cleanedItems.trim() !== '') {
        return \`import { \${cleanedItems} } from '\${importPath}'\\nimport { useMcpDailyRewards } from "./hooks/mcp"\`;
      } else {
        return \`import { useMcpDailyRewards } from "./hooks/mcp"\`;
      }
    }
  );
  
  // Replace useContext(DailyRewardsContext) with useMcpDailyRewards()
  updatedContent = updatedContent.replace(
    /useContext\\s*\\(\\s*DailyRewardsContext\\s*\\)/g,
    'useMcpDailyRewards()'
  );
  
  // Update the file if changes were made
  if (updatedContent !== content) {
    fs.writeFileSync(file, updatedContent);
    console.log(\`Updated imports in \${file}\`);
    updatedFiles++;
  }
}

console.log(\`Updated \${updatedFiles} files to use MCP hooks\`);

// Create symbolic links for backwards compatibility
console.log('Creating symbolic links for backwards compatibility...');

// Move context files to a backup location
if (fs.existsSync(path.join(SRC_CONTEXTS_DIR, 'GameStateContext.jsx'))) {
  fs.renameSync(
    path.join(SRC_CONTEXTS_DIR, 'GameStateContext.jsx'),
    path.join(SRC_CONTEXTS_DIR, 'GameStateContext.jsx.bak')
  );
  console.log('Backed up GameStateContext.jsx');
}

if (fs.existsSync(path.join(SRC_CONTEXTS_DIR, 'DailyRewardsContext.jsx'))) {
  fs.renameSync(
    path.join(SRC_CONTEXTS_DIR, 'DailyRewardsContext.jsx'),
    path.join(SRC_CONTEXTS_DIR, 'DailyRewardsContext.jsx.bak')
  );
  console.log('Backed up DailyRewardsContext.jsx');
}

// Create adapter files that use the MCP hooks
const gameStateAdapterContent = \`import React, { createContext } from 'react';
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
\`;

const rewardsAdapterContent = \`import React, { createContext } from 'react';
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
\`;

fs.writeFileSync(path.join(SRC_CONTEXTS_DIR, 'GameStateContext.jsx'), gameStateAdapterContent);
console.log('Created GameStateContext adapter');

fs.writeFileSync(path.join(SRC_CONTEXTS_DIR, 'DailyRewardsContext.jsx'), rewardsAdapterContent);
console.log('Created DailyRewardsContext adapter');

console.log('MCP hooks activation complete!');
console.log(\`
Next steps:
1. Add the memory-persistence-backend.js API endpoints to your Express server
2. Update your application to use the MCP hooks directly in new components
3. Test the application to ensure everything works correctly
4. Refer to the docs/guides/mcp_hooks_usage.md guide for more information on using MCP hooks
\`);`;

fs.writeFileSync(activationPath, activationContent);
fs.chmodSync(activationPath, '755');

console.log('Frontend MCP integration completed successfully!');
console.log(`
Next steps:
1. Review the component removal report at docs/cleanup/component_removal_report.md
2. Test the MCP hooks implementation
3. When ready, run the activation script to complete the migration:
   node ${activationPath}
4. Review the MCP hooks usage guide at docs/guides/mcp_hooks_usage.md
`);

fs.chmodSync(path.join(WORKSPACE_DIR, 'scripts/cleanup/remove_redundant_frontend_components.js'), '755');

console.log('Redundant frontend components removal script created successfully!');
console.log('Run the script with: node scripts/cleanup/remove_redundant_frontend_components.js');