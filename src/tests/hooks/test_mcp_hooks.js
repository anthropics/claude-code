#!/usr/bin/env node

/**
 * Test MCP Hooks Implementation
 * ==============================
 * 
 * This script tests the MCP hooks implementation by simulating React hook usage.
 */

const http = require('http');
const { useMcpGameState } = require('../../src/hooks/mcp/useGameState');
const { useMcpDailyRewards } = require('../../src/hooks/mcp/useDailyRewards');

// Mock React hooks
const useState = (initialValue) => {
  let state = initialValue;
  const setState = (newValue) => {
    if (typeof newValue === 'function') {
      state = newValue(state);
    } else {
      state = newValue;
    }
    console.log('State updated:', state);
  };
  return [state, setState];
};

const useEffect = (callback, deps) => {
  console.log('Running effect with deps:', deps);
  callback();
};

// Mock fetch API
global.fetch = async (url, options) => {
  return {
    ok: true,
    json: async () => {
      if (url.includes('/get')) {
        return { success: true, value: null };
      } else if (url.includes('/set')) {
        return { success: true };
      } else {
        return { success: false };
      }
    }
  };
};

// Mock React
global.React = {
  useState,
  useEffect
};

// Start simple test server to receive API requests
const server = http.createServer((req, res) => {
  console.log(`Received request: ${req.method} ${req.url}`);
  
  // Read request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    console.log('Request body:', body);
    
    // Send response
    res.setHeader('Content-Type', 'application/json');
    
    if (req.url.includes('/get')) {
      res.end(JSON.stringify({ success: true, value: null }));
    } else if (req.url.includes('/set')) {
      res.end(JSON.stringify({ success: true }));
    } else {
      res.end(JSON.stringify({ success: false }));
    }
  });
});

// Test game state hook
async function testGameStateHook() {
  console.log('=== Testing Game State Hook ===');
  
  // Simulate React component using the hook
  const { gameState, updateScore, levelUp, addToInventory } = useMcpGameState();
  
  console.log('Initial game state:', gameState);
  
  // Test the hook functions
  if (updateScore) {
    console.log('Testing updateScore...');
    await updateScore(100);
  }
  
  if (levelUp) {
    console.log('Testing levelUp...');
    await levelUp();
  }
  
  if (addToInventory) {
    console.log('Testing addToInventory...');
    await addToInventory({ id: 'sword', name: 'Mighty Sword' });
  }
  
  console.log('=== Game State Hook Test Complete ===');
}

// Test daily rewards hook
async function testDailyRewardsHook() {
  console.log('=== Testing Daily Rewards Hook ===');
  
  // Simulate React component using the hook
  const { rewards, canClaimToday, claimDailyReward } = useMcpDailyRewards();
  
  console.log('Initial rewards state:', rewards);
  
  // Test the hook functions
  if (canClaimToday) {
    console.log('Can claim today:', canClaimToday());
  }
  
  if (claimDailyReward) {
    console.log('Testing claimDailyReward...');
    await claimDailyReward();
  }
  
  console.log('=== Daily Rewards Hook Test Complete ===');
}

// Main test function
async function runTests() {
  console.log('Starting MCP hooks tests...');
  
  // Start test server
  server.listen(3033, () => {
    console.log('Test server listening on port 3033');
  });
  
  try {
    // Run tests
    await testGameStateHook();
    await testDailyRewardsHook();
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Close test server
    server.close();
  }
}

// Run tests
runTests();