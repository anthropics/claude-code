# Error Handling API Documentation

The Error Handling API provides standardized error handling for the Claude Neural Framework.

## Error Classes

The framework provides a hierarchy of error classes for different types of errors:

```javascript
const {
  FrameworkError,
  ConfigError,
  MCPError,
  RAGError,
  ValidationError,
  handleError,
  formatError,
  createError
} = require('../core/error/error_handler');
```

### FrameworkError

Base error class for all framework errors.

```javascript
throw new FrameworkError('Something went wrong', {
  code: 'ERR_CUSTOM',
  status: 500,
  component: 'component-name',
  cause: originalError,
  metadata: { key: 'value' },
  isOperational: true
});
```

Properties:
- `name` (string): Error name ('FrameworkError')
- `message` (string): Error message
- `code` (string): Error code (default: 'ERR_FRAMEWORK_UNKNOWN')
- `status` (number): HTTP status code (default: 500)
- `component` (string): Component where the error occurred (default: 'framework')
- `cause` (Error): Original error that caused this error
- `metadata` (Object): Additional error metadata
- `isOperational` (boolean): Whether this is an operational error (default: true)
- `timestamp` (Date): When the error occurred
- `stack` (string): Stack trace

### ConfigError

Error related to configuration.

```javascript
throw new ConfigError('Invalid configuration', {
  code: 'ERR_CONFIG_INVALID',
  metadata: { key: 'invalid-key' }
});
```

Properties:
- `name` (string): Error name ('ConfigError')
- `code` (string): Error code (default: 'ERR_CONFIG')
- `component` (string): Component name (default: 'config')
- `status` (number): HTTP status code (default: 500)

### MCPError

Error related to MCP operations.

```javascript
throw new MCPError('Failed to connect to MCP server', {
  code: 'ERR_MCP_CONNECTION',
  metadata: { server: 'sequentialthinking' }
});
```

Properties:
- `name` (string): Error name ('MCPError')
- `code` (string): Error code (default: 'ERR_MCP')
- `component` (string): Component name (default: 'mcp')
- `status` (number): HTTP status code (default: 500)

### RAGError

Error related to RAG operations.

```javascript
throw new RAGError('Failed to generate embeddings', {
  code: 'ERR_RAG_EMBEDDING',
  metadata: { model: 'voyage' }
});
```

Properties:
- `name` (string): Error name ('RAGError')
- `code` (string): Error code (default: 'ERR_RAG')
- `component` (string): Component name (default: 'rag')
- `status` (number): HTTP status code (default: 500)

### ValidationError

Error related to input validation.

```javascript
throw new ValidationError('Invalid input', {
  code: 'ERR_VALIDATION_INPUT',
  metadata: { field: 'username', constraint: 'required' }
});
```

Properties:
- `name` (string): Error name ('ValidationError')
- `code` (string): Error code (default: 'ERR_VALIDATION')
- `component` (string): Component name (default: 'validation')
- `status` (number): HTTP status code (default: 400)

## Error Handling Functions

### handleError(error)

Handles an error according to its type and severity.

```javascript
const result = handleError(error);
```

Parameters:
- `error` (Error): Error to handle

Returns:
- (Object): Formatted error response

Behavior:
- Logs the error with appropriate level
- For operational errors, logs and returns formatted error
- For programmer errors (bugs), logs, exits in production, and returns formatted error in development

### formatError(error)

Formats an error for API responses.

```javascript
const formattedError = formatError(error);
response.status(formattedError.status || 500).json({ error: formattedError });
```

Parameters:
- `error` (Error): Error to format

Returns:
- (Object): Formatted error object with:
  - `message` (string): Error message
  - `code` (string): Error code
  - `status` (number): HTTP status code
  - `component` (string): Component name (if available)
  - `metadata` (Object): Error metadata (if available, sanitized)

### createError(message, errorType, options)

Creates a specific error type from a string.

```javascript
const error = createError('Invalid configuration', 'ConfigError', {
  status: 400,
  metadata: { config: 'mcp' }
});
```

Parameters:
- `message` (string): Error message
- `errorType` (string): Type of error to create ('FrameworkError', 'ConfigError', etc.)
- `options` (Object, optional): Additional error options

Returns:
- (Error): Created error object

## Global Error Handlers

The framework sets up global error handlers for uncaught exceptions and unhandled promise rejections.

### setupGlobalHandlers()

Sets up global error handlers.

```javascript
const { setupGlobalHandlers } = require('../core/error/error_handler');
setupGlobalHandlers();
```

## Best Practices

### Operational vs. Programmer Errors

The framework distinguishes between two types of errors:

1. **Operational Errors**: Expected errors that occur during normal operation
   - Examples: network failures, validation errors, resource not found
   - These are handled gracefully and don't crash the application
   - Set `isOperational: true` (default)

2. **Programmer Errors**: Bugs in the code that should be fixed
   - Examples: undefined is not a function, null pointer exceptions
   - These are logged and may crash the application in production
   - Set `isOperational: false`

```javascript
// Operational error (normal)
throw new FrameworkError('Resource not found', {
  code: 'ERR_NOT_FOUND',
  status: 404,
  isOperational: true // Default, can be omitted
});

// Programmer error (bug)
throw new FrameworkError('Internal implementation error', {
  code: 'ERR_IMPLEMENTATION',
  isOperational: false // This is a bug
});
```

### Error Propagation

Always propagate errors up the call stack:

```javascript
async function doSomething() {
  try {
    // Operation that might fail
  } catch (error) {
    // Add context to the error
    throw new FrameworkError('Failed to do something', {
      cause: error,
      metadata: { operation: 'doSomething' }
    });
  }
}
```

### Error Codes

Use consistent error codes:

```javascript
// Framework-level error codes
'ERR_FRAMEWORK_UNKNOWN'  // Unknown framework error
'ERR_CONFIG'            // Configuration error
'ERR_MCP'               // MCP error
'ERR_RAG'               // RAG error
'ERR_VALIDATION'        // Validation error

// Component-specific error codes
'ERR_CONFIG_INVALID'    // Invalid configuration
'ERR_CONFIG_NOT_FOUND'  // Configuration not found
'ERR_MCP_CONNECTION'    // MCP connection error
'ERR_MCP_TIMEOUT'       // MCP timeout error
'ERR_RAG_EMBEDDING'     // RAG embedding error
'ERR_RAG_DATABASE'      // RAG database error
```

### HTTP Status Codes

Map error types to appropriate HTTP status codes:

```javascript
// 400 Bad Request - Client sent invalid data
throw new ValidationError('Invalid input', { status: 400 });

// 401 Unauthorized - Authentication required
throw new FrameworkError('Authentication required', { status: 401 });

// 403 Forbidden - Client not allowed to access resource
throw new FrameworkError('Access denied', { status: 403 });

// 404 Not Found - Resource not found
throw new FrameworkError('Resource not found', { status: 404 });

// 409 Conflict - Resource conflict
throw new FrameworkError('Resource already exists', { status: 409 });

// 422 Unprocessable Entity - Validation error
throw new ValidationError('Invalid input', { status: 422 });

// 429 Too Many Requests - Rate limit exceeded
throw new FrameworkError('Rate limit exceeded', { status: 429 });

// 500 Internal Server Error - Server error
throw new FrameworkError('Internal server error', { status: 500 });

// 503 Service Unavailable - Service temporarily unavailable
throw new FrameworkError('Service unavailable', { status: 503 });
```

### Error Metadata

Include relevant metadata in errors:

```javascript
throw new ValidationError('Invalid input', {
  metadata: {
    field: 'username',
    constraint: 'required',
    value: '', // Sanitized value
    requestId: '123456',
    timestamp: new Date().toISOString()
  }
});
```

### Error Handling in Async Functions

Use try-catch in async functions:

```javascript
async function processUser(userId) {
  try {
    const user = await getUser(userId);
    await updateUser(user);
    return user;
  } catch (error) {
    if (error instanceof FrameworkError) {
      // Handle known error types
      throw error;
    } else {
      // Wrap unknown errors
      throw new FrameworkError('Failed to process user', {
        cause: error,
        metadata: { userId }
      });
    }
  }
}
```

### Error Handling in Express Middleware

Use the error handler in Express middleware:

```javascript
const express = require('express');
const { handleError } = require('../core/error/error_handler');

const app = express();

// ... routes and middleware ...

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  const formattedError = handleError(err);
  res.status(formattedError.status || 500).json({
    error: formattedError
  });
});
```