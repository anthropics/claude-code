# Testing Guide for Claude Neural Framework

This guide documents the testing approach and best practices for the Claude Neural Framework.

## Overview

The Claude Neural Framework uses a comprehensive testing strategy with three levels of tests:

1. **Unit Tests**: Test individual functions, classes, and modules in isolation
2. **Integration Tests**: Test how components work together
3. **End-to-End Tests**: Test the entire system as users would experience it

## Test Structure

Tests are organized in the `/tests` directory with the following structure:

```
/tests
  /unit               # Unit tests
  /integration        # Integration tests
  /e2e                # End-to-end tests
  /utils              # Testing utilities and helpers
  jest.setup.js       # Jest setup for unit tests
  jest.integration.setup.js  # Jest setup for integration tests
  jest.e2e.setup.js   # Jest setup for E2E tests
```

## Testing Tools

The framework uses these testing libraries:

- **Jest**: Primary test runner and assertion library
- **Mocha**: Alternative test framework for specific test cases
- **Chai**: BDD/TDD assertion library
- **Sinon**: Test spies, stubs, and mocks
- **SuperTest**: HTTP assertions for API testing
- **NYC (Istanbul)**: Code coverage reports

## Running Tests

Use these npm scripts to run tests:

```bash
# Run unit tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with Mocha
npm run test:mocha

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Run all tests (unit, integration, e2e)
npm run test:all
```

## Writing Tests

### File Naming Conventions

- Unit tests: `*.test.js` or `*.spec.js`
- Integration tests: `*.integration.test.js`
- End-to-End tests: `*.e2e.test.js`
- Mocha tests: `*.mocha.js`

### Test Structure

Follow this structure for tests:

```javascript
// Import test subjects and dependencies
const { someFunction } = require('../path/to/module');
const { createMockLogger } = require('../tests/utils/mock-factories');

// Group related tests with 'describe'
describe('Module: someModule', () => {
  // Setup and teardown
  let mockLogger;
  
  beforeEach(() => {
    mockLogger = createMockLogger();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  // Test cases
  test('should perform expected action', () => {
    // Arrange
    const input = 'test input';
    
    // Act
    const result = someFunction(input, mockLogger);
    
    // Assert
    expect(result).toBe('expected output');
    expect(mockLogger.info).toHaveBeenCalledWith('Some log message');
  });
  
  // More test cases...
});
```

### Testing Utilities

The framework provides several testing utilities:

- **`test-helpers.js`**: Common test helpers like temp directories and wait functions
- **`mock-factories.js`**: Factories for creating mock objects

Example usage:

```javascript
const { createTestEnv } = require('../tests/utils/test-helpers');
const { createMockLogger } = require('../tests/utils/mock-factories');

test('should use test environment', () => {
  // Create test environment with mock configs
  const testEnv = createTestEnv({
    'mcp': { version: '1.0.0', servers: {} }
  });
  
  // Use mocks
  const mockLogger = createMockLogger();
  
  // Run tests
  
  // Clean up
  testEnv.cleanup();
});
```

## Test Coverage

Aim for high test coverage, especially for critical components:

- Core modules: 90%+ coverage
- MCP integration: 85%+ coverage
- CLI commands: 80%+ coverage
- UI components: 75%+ coverage

Run coverage reports with:

```bash
npm run test:coverage
```

The report shows:
- Statement coverage
- Branch coverage
- Function coverage
- Line coverage

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on other tests
2. **Mock External Dependencies**: Use mocks for APIs, databases, and file systems
3. **Arrange, Act, Assert**: Structure tests with these three phases
4. **Test Edge Cases**: Include tests for error conditions and edge cases
5. **Meaningful Assertions**: Assert specific behaviors, not implementation details
6. **Clean Up**: Always clean up resources after tests
7. **Descriptive Names**: Use clear test and describe names that explain what's being tested
8. **Test First Approach**: Write tests before or alongside implementation

## Integration with CI/CD

Tests run automatically in the CI/CD pipeline:

1. Unit tests run on every push
2. Integration tests run on PR to main branches
3. E2E tests run before deployment
4. Coverage reports are generated and published

## Troubleshooting Tests

Common test issues and solutions:

1. **Failing Tests**: Check for environment dependencies or timing issues
2. **Slow Tests**: Look for missing mocks or unnecessary I/O operations
3. **Flaky Tests**: Identify and fix race conditions or environment dependencies
4. **Low Coverage**: Add tests for untested code paths and edge cases

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing JavaScript](https://testingjavascript.com/)
- [Integration Testing Best Practices](https://martinfowler.com/bliki/IntegrationTest.html)
- [Test Doubles: Mocks, Stubs and Fakes](https://martinfowler.com/bliki/TestDouble.html)