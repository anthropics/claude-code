# Logging System Guide

This guide explains how to use the standardized logging system of the Claude Neural Framework for consistent logging across all components.

## Overview

The logging system provides a centralized way to manage all logs in the Claude Neural Framework with features including:

- **Log Levels**: Different severity levels for messages (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)
- **Formatted Output**: JSON, text, and pretty-printed formats
- **Multiple Outputs**: Console and file output with rotation
- **Structured Metadata**: Support for attaching structured data to log entries
- **Colorized Output**: Visual differentiation of log levels in console output
- **Child Loggers**: Create specialized loggers inheriting from parent configuration
- **Configurable**: Extensive configuration options for customization

## Basic Usage

### Getting Started

```javascript
const logger = require('./core/logging/logger');

// Basic logging with different levels
logger.trace('Detailed trace information');
logger.debug('Debugging information');
logger.info('Normal application behavior');
logger.warn('Warning conditions');
logger.error('Error conditions');
logger.fatal('Severe conditions that may cause the application to terminate');
```

### Logging with Metadata

```javascript
// Add structured metadata to your log entries
logger.info('User authenticated', {
  userId: 'user123',
  loginMethod: 'oauth',
  ipAddress: '192.168.1.1'
});

// Log errors with error objects
try {
  // Some operation that might fail
} catch (err) {
  logger.error('Failed to process request', {
    error: err,
    requestId: 'abc-123',
    parameters: { foo: 'bar' }
  });
}
```

### Creating Named Loggers

```javascript
// Create a named logger for a specific component
const { createLogger } = require('./core/logging/logger');

const mcpLogger = createLogger('mcp-server');
const ragLogger = createLogger('rag-system');

mcpLogger.info('MCP server started');
ragLogger.info('RAG system initialized');
```

## Configuration

### Default Configuration

The logging system uses the following default configuration:

```javascript
{
  level: LOG_LEVELS.INFO,        // Minimum log level to output
  format: 'json',                // Log format ('json', 'text', 'pretty')
  colorize: true,                // Colorize console output
  timestamp: true,               // Include timestamps
  showSource: true,              // Include source file and line
  showHostname: false,           // Include hostname
  logDirectory: '~/.claude/logs', // Directory for log files
  filename: 'claude-neural-framework.log', // Log filename
  consoleOutput: true,           // Output to console
  fileOutput: false,             // Output to file
  maxFileSize: 10 * 1024 * 1024, // Maximum log file size (10 MB)
  maxFiles: 5,                   // Maximum number of log files to keep
  customLevels: {},              // Custom log levels
  customFormatters: {},          // Custom formatters
  prettyPrint: false             // Format JSON logs for readability
}
```

### Configuring via Configuration Manager

Logging configuration is managed through the standardized configuration system:

```javascript
const configManager = require('./core/config/config_manager');
const { CONFIG_TYPES } = configManager;

// Update logging configuration
configManager.updateConfigValue(CONFIG_TYPES.GLOBAL, 'logging.level', 'DEBUG');
configManager.updateConfigValue(CONFIG_TYPES.GLOBAL, 'logging.fileOutput', true);
```

Example configuration in `~/.claude/config.json`:

```json
{
  "version": "1.0.0",
  "logging": {
    "level": "DEBUG",
    "format": "json",
    "fileOutput": true,
    "logDirectory": "/var/log/claude",
    "showSource": true
  }
}
```

### Creating Custom Logger Instances

```javascript
const { Logger, LOG_LEVELS } = require('./core/logging/logger');

// Create a custom logger with specific configuration
const customLogger = new Logger({
  name: 'custom-component',
  level: LOG_LEVELS.DEBUG,
  format: 'text',
  colorize: true,
  fileOutput: true,
  filename: 'custom-component.log'
});

customLogger.debug('This is a debug message');
```

### Creating Child Loggers

```javascript
const logger = require('./core/logging/logger');

// Create a child logger that inherits parent configuration
const childLogger = logger.child({
  name: 'child-component'
});

childLogger.info('This log entry will include the child name');
```

### Changing Log Level at Runtime

```javascript
const logger = require('./core/logging/logger');
const { LOG_LEVELS } = logger;

// Set log level by name
logger.setLevel('DEBUG');

// Or by level constant
logger.setLevel(LOG_LEVELS.TRACE);

// Update other configuration options
logger.configure({
  format: 'pretty',
  showHostname: true
});
```

## Log Format Examples

### JSON Format

```json
{
  "timestamp": "2023-05-11T08:15:30.123Z",
  "level": 30,
  "levelName": "INFO",
  "message": "User authenticated",
  "name": "auth-service",
  "source": {
    "function": "authenticateUser",
    "file": "auth.js",
    "line": "42",
    "column": "3"
  },
  "userId": "user123",
  "loginMethod": "oauth",
  "ipAddress": "192.168.1.1"
}
```

### Text Format

```
[2023-05-11T08:15:30.123Z] INFO [auth-service] (auth.js:42) User authenticated { userId: 'user123', loginMethod: 'oauth', ipAddress: '192.168.1.1' }
```

## Advanced Usage

### Custom Log Levels

```javascript
const { Logger, LOG_LEVELS } = require('./core/logging/logger');

const customLogger = new Logger({
  name: 'custom-levels',
  customLevels: {
    AUDIT: 35, // Between INFO and WARN
    METRIC: 15  // Between TRACE and DEBUG
  }
});

// These methods are automatically added
customLogger.audit('User performed sensitive action');
customLogger.metric('Performance measurement');
```

### Custom Formatters

```javascript
const { Logger } = require('./core/logging/logger');

const customLogger = new Logger({
  name: 'custom-formatter',
  customFormatters: {
    csv: (entry) => {
      const { timestamp, levelName, message, name } = entry;
      return `${timestamp},${levelName},${name},"${message}"`;
    }
  },
  format: 'csv'
});

customLogger.info('This will be formatted as CSV');
```

### Integration with Error Handling

```javascript
const logger = require('./core/logging/logger');
const { ConfigError } = require('./core/config/config_manager');

function handleApiRequest(req, res) {
  try {
    // Process request
  } catch (err) {
    if (err instanceof ConfigError) {
      logger.error('Configuration error occurred', {
        error: err,
        requestId: req.id,
        endpoint: req.url
      });
      res.status(500).json({ error: 'Server configuration error' });
    } else {
      logger.error('Unexpected error occurred', {
        error: err,
        stack: err.stack,
        requestId: req.id,
        endpoint: req.url
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

### Structured Error Logging

```javascript
const logger = require('./core/logging/logger');

try {
  // Operation that might fail
} catch (err) {
  logger.error('Failed to process request', {
    error: {
      message: err.message,
      name: err.name,
      stack: err.stack,
      code: err.code
    },
    context: {
      operation: 'processPayment',
      userId: 'user123',
      amount: 99.99
    },
    timestamp: Date.now()
  });
}
```

## Example: Component Integration

Here's a complete example of how to integrate a component with the logging system:

```javascript
// file: core/mcp/claude_integration.js
const logger = require('../logging/logger').createLogger('claude-integration');
const { ConfigError } = require('../config/config_manager');

class ClaudeIntegration {
  constructor(options = {}) {
    logger.debug('Initializing Claude Integration', { options });
    
    try {
      // Initialization logic
      logger.info('Claude Integration initialized successfully');
    } catch (err) {
      logger.error('Failed to initialize Claude Integration', { 
        error: err,
        options
      });
      throw err;
    }
  }
  
  async generateResponse(prompt, options = {}) {
    const requestId = generateRequestId();
    
    logger.debug('Generating response', {
      requestId,
      promptLength: prompt.length,
      options
    });
    
    try {
      // Call Claude API
      const startTime = Date.now();
      const response = await callClaudeApi(prompt, options);
      const duration = Date.now() - startTime;
      
      logger.info('Generated response successfully', {
        requestId,
        duration,
        tokensUsed: response.usage,
        responseLength: response.text.length
      });
      
      return response;
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        logger.error('Connection refused while calling Claude API', {
          requestId,
          error: err
        });
        throw new ClaudeConnectionError('Failed to connect to Claude API');
      } else if (err.response && err.response.status === 429) {
        logger.warn('Rate limit exceeded', {
          requestId,
          retryAfter: err.response.headers['retry-after']
        });
        throw new ClaudeRateLimitError('Rate limit exceeded');
      } else {
        logger.error('Error generating response', {
          requestId,
          error: err
        });
        throw new ClaudeApiError('Failed to generate response');
      }
    }
  }
}

// Helper functions and error classes
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

class ClaudeApiError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ClaudeApiError';
  }
}

class ClaudeConnectionError extends ClaudeApiError {
  constructor(message) {
    super(message);
    this.name = 'ClaudeConnectionError';
  }
}

class ClaudeRateLimitError extends ClaudeApiError {
  constructor(message) {
    super(message);
    this.name = 'ClaudeRateLimitError';
  }
}

module.exports = ClaudeIntegration;
```

## Best Practices

1. **Use the Right Log Level**: Choose the appropriate log level based on the message importance:
   - `TRACE`: Extremely detailed information for debugging
   - `DEBUG`: Useful development information
   - `INFO`: Normal application behavior
   - `WARN`: Potential issues that don't prevent operation
   - `ERROR`: Errors that prevent an operation from completing
   - `FATAL`: Severe errors that may cause application termination

2. **Include Contextual Information**: Add relevant metadata to log entries to provide context.

3. **Create Component-Specific Loggers**: Use named loggers for each component to easily filter logs.

4. **Standardize Error Logs**: Include error objects, stack traces, and contextual information.

5. **Log Request/Response Cycles**: Log the start and end of operations with timing information.

6. **Be Consistent with Log Formats**: Stick to a consistent format for similar types of logs.

7. **Don't Log Sensitive Information**: Never log passwords, API keys, or personal identifiable information.

8. **Configure Log Levels by Environment**: Use more verbose logging in development, and less in production.

## Conclusion

The standardized logging system provides a robust foundation for logging in the Claude Neural Framework. By following these guidelines, you can ensure that your components integrate seamlessly with the rest of the framework and provide consistent logging for easier debugging and monitoring.