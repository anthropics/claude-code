# SAAR-MCP Tests

This directory contains automated tests for the SAAR-MCP integration. These tests cover integration, performance, and security aspects of the SAAR-MCP integration.

## Test Categories

1. **Integration Tests** - Tests that the integration between SAAR and MCP tools works correctly
2. **Performance Tests** - Tests the performance of the integration
3. **Security Tests** - Tests the security aspects of the integration

## Running Tests

### Prerequisites

- Node.js 14 or higher
- npm 6 or higher
- SAAR-MCP integration installed and configured

### Installation

Install dependencies:

```bash
cd tests/saar-mcp
npm install
```

### Running Tests

Run all tests:

```bash
npm test
```

Run specific test categories:

```bash
# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance

# Run security tests
npm run test:security
```

### Generating Reports

After running the tests, you can generate comprehensive reports:

```bash
npm run report
```

This will generate HTML and Markdown reports in the `reports` directory.

## Test Files

- `integration.test.js` - Tests that verify the core functionality of the SAAR-MCP integration
- `performance.test.js` - Tests that measure the performance of various operations
- `security.test.js` - Tests that check for security vulnerabilities

## Report Generation

The report generation script creates:

1. HTML report with visualizations
2. Markdown report for documentation

Reports include:
- Summary of all test results
- Detailed performance metrics
- Security vulnerabilities (if any)
- Recommendations for improvements

## Adding New Tests

To add new tests:

1. Create a new test file in this directory
2. Follow the existing test structure
3. Add your test suite using Jest's `describe` and `test` functions
4. Run the tests to verify they work correctly

## Continuous Integration

These tests are designed to be run in a CI/CD pipeline. To integrate with CI/CD:

1. Add a test job to your CI/CD configuration
2. Install dependencies
3. Run the tests
4. Generate and publish the reports

## Security Considerations

The security tests check for common vulnerabilities such as:

- Command injection
- Path traversal
- Insecure temporary files
- Directory access control

If any security tests fail, address them immediately before deploying.