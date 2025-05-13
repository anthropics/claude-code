/**
 * End-to-End Test for Framework Startup
 * 
 * Tests the startup sequence of the Claude Neural Framework.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

// Promisified functions
const exec = promisify(require('child_process').exec);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Environment variables for testing
process.env.NODE_ENV = 'test';

describe('Framework Startup E2E Test', () => {
  // 30 second timeout for E2E tests
  jest.setTimeout(30000);
  
  // Mock API keys for testing
  const mockApiKeys = {
    CLAUDE_API_KEY: 'test-claude-api-key',
    VOYAGE_API_KEY: 'test-voyage-api-key',
    BRAVE_API_KEY: 'test-brave-api-key',
    MCP_API_KEY: 'test-mcp-api-key'
  };
  
  // Store original environment variables
  const originalEnv = { ...process.env };
  
  // Add mock API keys to environment
  beforeAll(() => {
    Object.entries(mockApiKeys).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });
  
  // Restore original environment variables
  afterAll(() => {
    process.env = originalEnv;
  });
  
  test('should start the MCP server and initialize framework components', async () => {
    // Command to run the server
    const serverPath = path.resolve(__dirname, '../../core/mcp/start_server.js');
    
    // Spawn server process
    const serverProcess = spawn('node', [serverPath, '--test-mode'], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Collect output
    let stdout = '';
    let stderr = '';
    
    serverProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    serverProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Wait for server to start (looking for specific log message)
    try {
      // Wait up to 5 seconds for server to start
      let attempts = 0;
      const maxAttempts = 10;
      let serverStarted = false;
      
      while (attempts < maxAttempts && !serverStarted) {
        if (stdout.includes('MCP server started') || 
            stdout.includes('Server listening') || 
            stdout.includes('Framework initialized')) {
          serverStarted = true;
        } else {
          await sleep(500);
          attempts += 1;
        }
      }
      
      // Kill the server
      serverProcess.kill();
      
      // Check if server started
      expect(serverStarted).toBe(true);
      
      // Check for key components in logs
      expect(stdout).toMatch(/config(uration)?\s+loaded|loaded\s+config(uration)?/i);
      
      // These assertions are more flexible since log format might vary
      // Looking for evidence that each component initialized
      const configInitialized = /config(uration)?\s+(manager)?\s+(initialized|loaded|started)/i.test(stdout);
      const loggerInitialized = /log(ger)?\s+(initialized|started|configured)/i.test(stdout);
      const i18nInitialized = /i18n|internationalization|locale\s+(initialized|loaded|configured)/i.test(stdout);
      
      // Assert that components were initialized in some form
      expect(configInitialized || stdout.includes('config')).toBe(true);
      expect(loggerInitialized || stdout.includes('logger')).toBe(true);
      expect(i18nInitialized || stdout.includes('locale')).toBe(true);
      
      // Check for absence of errors
      expect(stderr).not.toMatch(/error|exception|failure/i);
    } catch (error) {
      // Make sure to kill the server on test failure
      serverProcess.kill();
      throw error;
    }
  });
});