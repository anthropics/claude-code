/**
 * Jest Setup for Unit Tests
 * 
 * This file contains setup code that runs before each unit test.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(5000);

// Global console mocking (uncomment if needed)
// global.console = {
//   log: jest.fn(),
//   error: jest.fn(),
//   warn: jest.fn(),
//   info: jest.fn(),
//   debug: jest.fn(),
// };

// Clean up after all tests
afterAll(() => {
  // Any global cleanup needed
});