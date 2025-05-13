/**
 * Jest Setup for End-to-End Tests
 * 
 * This file contains setup code that runs before each E2E test.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Increase timeout for E2E tests
jest.setTimeout(30000);

// Mock API keys for testing
process.env.CLAUDE_API_KEY = 'test-claude-api-key';
process.env.VOYAGE_API_KEY = 'test-voyage-api-key';
process.env.MCP_API_KEY = 'test-mcp-api-key';

// Global setup for E2E tests
beforeAll(async () => {
  // Start required servers and services
  console.log('Starting E2E test environment...');
  
  // You can start servers, services, databases, etc. here
});

// Global teardown for E2E tests
afterAll(async () => {
  // Shut down servers and services
  console.log('Shutting down E2E test environment...');
  
  // You can stop servers, services, close connections, etc. here
});