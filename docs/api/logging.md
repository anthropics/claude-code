# Logging API Documentation

The Logging API provides standardized logging functionality for the Claude Neural Framework.

## Logger

The `Logger` module provides a standardized logging interface with different log levels, formats, and outputs.

```javascript
const logger = require('../core/logging/logger').createLogger('component-name');
```

### Constants

#### LOG_LEVELS

Enumeration of supported log levels.

```javascript
const { LOG_LEVELS } = require('../core/logging/logger');

console.log(LOG_LEVELS.TRACE);  // 10
console.log(LOG_LEVELS.DEBUG);  // 20
console.log(LOG_LEVELS.INFO);   // 30
console.log(LOG_LEVELS.WARN);   // 40
console.log(LOG_LEVELS.ERROR);  // 50
console.log(LOG_LEVELS.FATAL);  // 60
console.log(LOG_LEVELS.SILENT); // 100
```

### Functions

#### `createLogger(component)`

Creates a new logger instance for a specific component.

```javascript
const logger = require('../core/logging/logger').createLogger('my-component');
```

Parameters:
- `component` (string): Component name for log attribution

Returns:
- (Object): Logger instance with the following methods:
  - `trace`
  - `debug`
  - `info`
  - `warn`
  - `error`
  - `fatal`
  - `child`

### Logger Instance Methods

#### `trace(message, metadata)`

Logs a trace message (lowest level).

```javascript
logger.trace('Detailed trace information', { key: 'value' });
```

Parameters:
- `message` (string): Log message
- `metadata` (Object, optional): Additional metadata

#### `debug(message, metadata)`

Logs a debug message.

```javascript
logger.debug('Debugging information', { key: 'value' });
```

Parameters:
- `message` (string): Log message
- `metadata` (Object, optional): Additional metadata

#### `info(message, metadata)`

Logs an informational message.

```javascript
logger.info('Operation succeeded', { operation: 'update', id: 123 });
```

Parameters:
- `message` (string): Log message
- `metadata` (Object, optional): Additional metadata

#### `warn(message, metadata)`

Logs a warning message.

```javascript
logger.warn('Resource not found, using default', { resource: 'config', path: '/etc/config.json' });
```

Parameters:
- `message` (string): Log message
- `metadata` (Object, optional): Additional metadata

#### `error(message, metadata)`

Logs an error message.

```javascript
logger.error('Operation failed', { error: err, operation: 'update' });
```

Parameters:
- `message` (string): Log message
- `metadata` (Object, optional): Additional metadata, typically including an `error` field

#### `fatal(message, metadata)`

Logs a fatal error message (highest level).

```javascript
logger.fatal('Application crashed', { error: err });
```

Parameters:
- `message` (string): Log message
- `metadata` (Object, optional): Additional metadata, typically including an `error` field

#### `child(subComponent)`

Creates a child logger with a sub-component name.

```javascript
const dbLogger = logger.child('database');
dbLogger.info('Connected to database'); // Logs with component 'my-component:database'
```

Parameters:
- `subComponent` (string): Sub-component name

Returns:
- (Object): Child logger instance

## Log Formatting

The framework supports multiple log formats:

### JSON Format

```javascript
// Example JSON format output
{
  "timestamp": "2025-05-11T12:34:56.789Z",
  "level": "info",
  "component": "my-component",
  "message": "Operation succeeded",
  "operation": "update",
  "id": 123
}
```

### Plain Text Format

```
[2025-05-11T12:34:56.789Z] [INFO] [my-component] Operation succeeded {"operation":"update","id":123}
```

## Log Storage

The framework supports multiple log storage destinations:

### Console

Logs to the console (stdout/stderr).

### File

Logs to a file with rotation support.

Default file path: `~/.claude/logs/claude.log`

### Custom Transport

You can implement and register custom log transports:

```javascript
const { registerTransport } = require('../core/logging/logger');

// Register a custom transport
registerTransport({
  name: 'custom-transport',
  log: (level, message, metadata) => {
    // Custom logging logic
    console.log(`[CUSTOM] [${level}] ${message}`, metadata);
  }
});
```

## Configuration

The logging system is configurable through the configuration system:

```javascript
// In configuration
{
  "logging": {
    "level": "info",           // Minimum log level to record
    "console": true,           // Whether to log to console
    "file": true,              // Whether to log to file
    "file_path": "~/.claude/logs/claude.log",  // Log file path
    "file_rotation": {
      "enabled": true,         // Whether to enable file rotation
      "max_size": "10m",       // Maximum file size
      "max_files": 5,          // Maximum number of files to keep
      "compress": true         // Whether to compress rotated files
    },
    "format": "json",          // Log format (json, plain)
    "colors": true,            // Whether to use colors in console output
    "timestamp": true,         // Whether to include timestamp
    "metadata": {
      "enabled": true,         // Whether to include metadata
      "include": ["timestamp", "level", "component"]  // Default metadata fields
    }
  }
}
```

## Best Practices

### Log Levels

Use the appropriate log level for each message:

- **TRACE**: Extremely detailed information, useful for debugging specific functions
- **DEBUG**: Detailed information, useful for debugging
- **INFO**: General information about system operation
- **WARN**: Warning messages, not errors but may indicate potential issues
- **ERROR**: Error messages, indicating a failure in the application
- **FATAL**: Critical errors causing the application to abort
- **SILENT**: No logging

### Structured Logging

Use structured logging with metadata for better analysis:

```javascript
// Good: Structured logging with metadata
logger.info('User authenticated', {
  userId: 123,
  method: 'password',
  duration: 235
});

// Bad: Unstructured logging
logger.info(`User 123 authenticated using password method in 235ms`);
```

### Context Preservation

Use child loggers to preserve context:

```javascript
// Create a logger for the auth module
const authLogger = logger.child('auth');

function authenticate(userId, method) {
  // All logs will include the 'auth' component
  authLogger.info('Authentication attempt', { userId, method });
  
  // Create a user-specific child logger
  const userLogger = authLogger.child(`user-${userId}`);
  
  // All logs will include both 'auth' and the specific user
  userLogger.info('Processing credentials');
}
```

### Error Logging

When logging errors, always include the error object:

```javascript
try {
  // Some operation
} catch (error) {
  logger.error('Failed to process request', {
    error,          // Include the error object
    requestId: 123,
    params: { /* sanitized parameters */ }
  });
}
```

### Sensitive Information

Never log sensitive information:

```javascript
// BAD: Logging sensitive information
logger.info('User authenticated', {
  username: 'john',
  password: 'secret',  // NEVER log passwords
  creditCard: '1234-5678-9012-3456'  // NEVER log full credit card numbers
});

// GOOD: Logging with sensitive information removed or masked
logger.info('User authenticated', {
  username: 'john',
  // No password
  creditCard: '****-****-****-3456'  // Masked
});
```