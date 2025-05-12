/**
 * MCP Hooks Library
 *
 * This library provides React hooks for interacting with MCP tools directly
 * from frontend components.
 */

// Import hooks
const { useMcpGameState } = require('./useGameState');
const { useMcpDailyRewards } = require('./useDailyRewards');
const { useMcpSequentialPlanner } = require('./useSequentialPlanner');

// Mock hooks for testing
const useMcpSequentialThinking = () => {
  return {
    generateThoughts: async () => [],
    continueThinking: async () => [],
    getConclusion: async () => 'Conclusion'
  };
};

const useMcpBraveSearch = () => {
  return {
    searchWeb: async () => [],
    nextPage: async () => {},
    previousPage: async () => {},
    results: [],
    totalResults: 0,
    currentPage: 0
  };
};

const useMcpImageGeneration = () => {
  return {
    generateImages: async () => [],
    getImagesById: async () => [],
    createGalleryHtml: async () => ''
  };
};

const useMcp21stDevMagic = () => {
  return {
    generateComponent: async () => ({ name: 'MockComponent', code: 'Mock code' })
  };
};

const useMcpRealTimeUpdates = () => {
  return {
    subscribe: () => {},
    unsubscribe: () => {}
  };
};

const useMcpContext7 = () => {
  return {
    searchDocuments: async () => []
  };
};

// Export all hooks
module.exports = {
  useMcpSequentialThinking,
  useMcpBraveSearch,
  useMcpImageGeneration,
  useMcp21stDevMagic,
  useMcpRealTimeUpdates,
  useMcpContext7,
  useMcpGameState,
  useMcpDailyRewards,
  useMcpSequentialPlanner
};
