/**
 * Jest Setup for Integration Tests
 * 
 * This file contains setup code that runs before each integration test.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Increase timeout for integration tests
jest.setTimeout(15000);

// Mock API keys for testing
process.env.CLAUDE_API_KEY = 'test-claude-api-key';
process.env.VOYAGE_API_KEY = 'test-voyage-api-key';
process.env.MCP_API_KEY = 'test-mcp-api-key';

// Global setup for integration tests
beforeAll(async () => {
  // Set up test databases or other resources
  console.log('Setting up integration test environment...');
  
  // You can add database setup, server startup, etc. here
});

// Global teardown for integration tests
afterAll(async () => {
  // Clean up test databases or other resources
  console.log('Tearing down integration test environment...');
  
  // You can add database cleanup, server shutdown, etc. here
});