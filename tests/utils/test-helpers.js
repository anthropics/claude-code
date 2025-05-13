/**
 * Test Helpers for Claude Neural Framework Tests
 * 
 * This file contains utility functions for testing the Claude Neural Framework.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Create a temporary test directory
 * 
 * @returns {string} Path to temporary directory
 */
function createTempTestDir() {
  const testDir = path.join(os.tmpdir(), `claude-neural-framework-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

/**
 * Remove a temporary test directory
 * 
 * @param {string} dirPath - Path to the directory to remove
 */
function removeTempTestDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        removeTempTestDir(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    }
    
    fs.rmdirSync(dirPath);
  }
}

/**
 * Create a mock configuration file for testing
 * 
 * @param {string} configType - Configuration type
 * @param {Object} configData - Configuration data
 * @param {string} [dirPath] - Directory path (defaults to temp directory)
 * @returns {string} Path to the created configuration file
 */
function createMockConfig(configType, configData, dirPath = null) {
  const tempDir = dirPath || createTempTestDir();
  const configPath = path.join(tempDir, `${configType}_config.json`);
  
  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
  
  return configPath;
}

/**
 * Create a testing environment with mocked configurations
 * 
 * @param {Object} configs - Map of configuration types to configuration data
 * @returns {Object} Environment info with paths and cleanup function
 */
function createTestEnv(configs = {}) {
  const testDir = createTempTestDir();
  const configPaths = {};
  
  // Create mock configuration files
  for (const [configType, configData] of Object.entries(configs)) {
    configPaths[configType] = createMockConfig(configType, configData, testDir);
  }
  
  // Return environment info
  return {
    testDir,
    configPaths,
    cleanup: () => removeTempTestDir(testDir)
  };
}

/**
 * Mock console for tests
 * 
 * @returns {Object} Mocked console and restore function
 */
function mockConsole() {
  const originalConsole = { ...console };
  
  // Create spies for console methods
  const mockedConsole = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };
  
  // Replace console methods with spies
  Object.assign(console, mockedConsole);
  
  // Return mocked console and restore function
  return {
    console: mockedConsole,
    restore: () => Object.assign(console, originalConsole)
  };
}

/**
 * Wait for a specified condition to be true
 * 
 * @param {Function} condition - Condition function that returns a boolean
 * @param {number} [timeout=5000] - Timeout in milliseconds
 * @param {number} [interval=100] - Check interval in milliseconds
 * @returns {Promise<void>}
 */
async function waitFor(condition, timeout = 5000, interval = 100) {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout (${timeout}ms) exceeded while waiting for condition`);
}

module.exports = {
  createTempTestDir,
  removeTempTestDir,
  createMockConfig,
  createTestEnv,
  mockConsole,
  waitFor
};