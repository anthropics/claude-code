/**
 * Jest Integration Testing Configuration for Claude Neural Framework
 * 
 * This configuration file sets up Jest for integration testing of the framework.
 */

module.exports = {
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: false,

  // The root directory that Jest should scan for tests and modules within
  rootDir: './',

  // A list of paths to directories that Jest should use to search for files in
  roots: ['<rootDir>'],

  // The test environment that will be used for testing
  testEnvironment: 'node',

  // The glob patterns Jest uses to detect integration test files
  testMatch: [
    '**/tests/integration/**/*.test.js',
    '**/*.integration.test.js'
  ],

  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  testPathIgnorePatterns: [
    '/node_modules/'
  ],

  // A map from regular expressions to paths to transformers
  transform: {},

  // Indicates whether each individual test should be reported during the run
  verbose: true,
  
  // A list of paths to modules that run some code to configure or set up the testing framework before each test
  setupFilesAfterEnv: ['<rootDir>/tests/jest.integration.setup.js'],

  // The maximum amount of time (in milliseconds) that a test can run before Jest aborts it
  // Increase timeout for integration tests
  testTimeout: 15000,

  // A set of global variables that need to be available in all test environments
  globals: {
    NODE_ENV: 'test',
  },
};