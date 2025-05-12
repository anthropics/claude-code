# Error Handling System Guide

This guide explains how to use the standardized error handling system of the Claude Neural Framework for consistent error management across all components.

## Overview

The error handling system provides a centralized way to manage errors in the Claude Neural Framework with features including:

- **Error Types**: Standardized error classes for different types of errors
- **Error Codes**: Unique error codes for easy identification
- **Operational vs. Programmer Errors**: Distinction between expected operational errors and unexpected programmer errors
- **Error Metadata**: Support for attaching metadata to errors
- **Global Error Handling**: Catch unhandled errors and rejected promises
- **Error Response Formatting**: Consistent error response format for APIs
- **Async Function Wrapping**: Simplified error handling for async functions

## Error Types

The framework provides the following error types, all extending from the base `FrameworkError` class:

| Error Type | Description | Default Code | Default Status |
|------------|-------------|--------------|----------------|
| ConfigurationError | Configuration-related errors | ERR_CONFIGURATION | 500 |
| ValidationError | Input validation errors | ERR_VALIDATION | 400 |
| ApiError | API-related errors | ERR_API | 500 |
| AuthenticationError | Authentication failures | ERR_AUTHENTICATION | 401 |
| AuthorizationError | Authorization failures | ERR_AUTHORIZATION | 403 |
| NotFoundError | Resource not found errors | ERR_NOT_FOUND | 404 |
| DatabaseError | Database-related errors | ERR_DATABASE | 500 |
| ExternalServiceError | External service errors | ERR_EXTERNAL_SERVICE | 502 |
| RateLimitError | Rate limiting errors | ERR_RATE_LIMIT | 429 |
| TimeoutError | Operation timeout errors | ERR_TIMEOUT | 504 |
| InternalError | Internal framework errors | ERR_INTERNAL | 500 |
| McpError | MCP-related errors | ERR_MCP | 500 |
| ClaudeApiError | Claude API errors | ERR_CLAUDE_API | 502 |

## Basic Usage

### Throwing Standard Errors

```javascript
const { 
  ValidationError, 
  NotFoundError, 
  DatabaseError 
} = require('./core/error/error_handler');

// Validation error
if (!isValid(input)) {
  throw new ValidationError('Invalid input parameter', {
    code: 'ERR_INVALID_INPUT',
    metadata: { input }
  });
}

// Not found error
const user = await findUser(userId);
if (!user) {
  throw new NotFoundError(`User with ID ${userId} not found`, {
    code: 'ERR_USER_NOT_FOUND',
    metadata: { userId }
  });
}

// Database error
try {
  await db.query(sql);
} catch (err) {
  throw new DatabaseError('Database query failed', {
    code: 'ERR_DB_QUERY_FAILED',
    cause: err,
    metadata: { query: sql }
  });
}
```

### Using the Error Handler

```javascript
const { errorHandler } = require('./core/error/error_handler');

// Handle errors manually
try {
  // Some operation that might fail
} catch (err) {
  errorHandler.handleError(err);
  // Decide whether to propagate the error
  throw err;
}

// Wrap async functions with error handling
const safeOperation = errorHandler.wrapAsync(async () => {
  // Some async operation that might fail
});

// Use the wrapped function
try {
  await safeOperation();
} catch (err) {
  // Error has already been handled by the error handler
  // Handle response to user
}
```

### Formatting Error Responses

```javascript
const { errorHandler } = require('./core/error/error_handler');

function handleApiRequest(req, res) {
  try {
    // Process request
  } catch (err) {
    const errorResponse = errorHandler.formatErrorResponse(err, process.env.NODE_ENV === 'development');
    res.status(errorResponse.status || 500).json(errorResponse);
  }
}
```

## Advanced Usage

### Creating Custom Error Types

```javascript
const { createErrorType, FrameworkError } = require('./core/error/error_handler');

// Create a custom error type
const PaymentError = createErrorType(
  'PaymentError',           // Error name
  'ERR_PAYMENT_FAILED',     // Default code
  402,                      // Default status
  'payment',                // Default component
  true                      // Default isOperational
);

// Use the custom error type
throw new PaymentError('Payment processing failed', {
  code: 'ERR_PAYMENT_DECLINED',
  metadata: { 
    transactionId: 'txn_123',
    reason: 'insufficient_funds'
  }
});

// Alternatively, create a more complex custom error class
class FileSystemError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_FILESYSTEM',
      status: options.status || 500,
      component: options.component || 'filesystem',
      isOperational: options.isOperational !== undefined ? options.isOperational : true,
      ...options
    });
    
    // Add custom properties
    this.path = options.path || null;
    this.operation = options.operation || null;
  }
  
  // Override toJSON to include custom properties
  toJSON() {
    return {
      ...super.toJSON(),
      path: this.path,
      operation: this.operation
    };
  }
}

// Use the custom error class
throw new FileSystemError('Failed to read file', {
  code: 'ERR_FILE_READ',
  path: '/path/to/file',
  operation: 'read'
});
```

### Customizing the Error Handler

```javascript
const { ErrorHandler } = require('./core/error/error_handler');

// Create a custom error handler
const customErrorHandler = new ErrorHandler({
  exitOnUnhandledRejection: process.env.NODE_ENV === 'production',
  exitOnUncaughtException: process.env.NODE_ENV === 'production',
  exitWithStackTrace: process.env.NODE_ENV !== 'production',
  onError: (error) => {
    // Custom error handling logic
    console.error(`[CUSTOM ERROR HANDLER] ${error.message}`);
    
    // Send error to monitoring service
    sendToMonitoring(error);
    
    // Log to file
    logToFile(error);
  }
});

// Use the custom error handler
customErrorHandler.handleError(error);
```

### Validating Request Parameters

```javascript
const { ValidationError } = require('./core/error/error_handler');

function validateUserInput(input) {
  const errors = [];
  
  if (!input.username) {
    errors.push({
      field: 'username',
      message: 'Username is required'
    });
  }
  
  if (!input.email || !isValidEmail(input.email)) {
    errors.push({
      field: 'email',
      message: 'Valid email is required'
    });
  }
  
  if (errors.length > 0) {
    throw new ValidationError('Invalid user input', {
      code: 'ERR_INVALID_USER_INPUT',
      validationErrors: errors,
      metadata: { input }
    });
  }
}
```

### Handling External Service Errors

```javascript
const { 
  ExternalServiceError, 
  TimeoutError, 
  RateLimitError 
} = require('./core/error/error_handler');

async function callExternalApi(endpoint, data) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        throw new RateLimitError('Rate limit exceeded', {
          retryAfter,
          metadata: { endpoint }
        });
      }
      
      throw new ExternalServiceError('External API request failed', {
        code: 'ERR_EXTERNAL_API_FAILED',
        status: response.status,
        metadata: { 
          endpoint,
          status: response.status,
          statusText: response.statusText
        }
      });
    }
    
    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new TimeoutError('External API request timed out', {
        code: 'ERR_EXTERNAL_API_TIMEOUT',
        metadata: { endpoint }
      });
    }
    
    // Rethrow RateLimitError
    if (err instanceof RateLimitError) {
      throw err;
    }
    
    // Wrap other errors
    throw new ExternalServiceError('External API call failed', {
      code: 'ERR_EXTERNAL_API_FAILED',
      cause: err,
      metadata: { endpoint }
    });
  }
}
```

## Example: Component Integration

Here's a complete example of how to integrate a component with the error handling system:

```javascript
// file: core/rag/rag_system.js
const logger = require('../logging/logger').createLogger('rag-system');
const { 
  errorHandler,
  ValidationError,
  DatabaseError,
  NotFoundError,
  InternalError,
  createErrorType
} = require('../error/error_handler');

// Create custom error types for RAG-specific errors
const EmbeddingError = createErrorType('EmbeddingError', 'ERR_EMBEDDING_FAILED', 500, 'rag');
const RetrievalError = createErrorType('RetrievalError', 'ERR_RETRIEVAL_FAILED', 500, 'rag');

class RagSystem {
  constructor(options = {}) {
    this.options = options;
    this.db = options.db;
    this.embeddingModel = options.embeddingModel;
  }
  
  // Wrap all public methods with error handling
  async query(text, options = {}) {
    return errorHandler.wrapAsync(async () => {
      return this._query(text, options);
    })();
  }
  
  // Internal implementation of query
  async _query(text, options = {}) {
    logger.debug('RAG query', { textLength: text.length, options });
    
    // Validate input
    if (!text || typeof text !== 'string') {
      throw new ValidationError('Query text must be a non-empty string', {
        code: 'ERR_INVALID_QUERY_TEXT',
        metadata: { text, options }
      });
    }
    
    try {
      // Generate embeddings
      let embedding;
      try {
        embedding = await this.embeddingModel.embed(text);
      } catch (err) {
        throw new EmbeddingError('Failed to generate embeddings', {
          code: 'ERR_EMBEDDING_GENERATION',
          cause: err,
          metadata: { textLength: text.length }
        });
      }
      
      // Query vector database
      let results;
      try {
        results = await this.db.query(embedding, options.limit || 5);
      } catch (err) {
        throw new DatabaseError('Vector database query failed', {
          code: 'ERR_VECTOR_DB_QUERY',
          cause: err,
          metadata: { options }
        });
      }
      
      // Check if results were found
      if (results.length === 0 && !options.allowEmptyResults) {
        throw new NotFoundError('No results found for query', {
          code: 'ERR_NO_RESULTS',
          metadata: { options }
        });
      }
      
      // Format results
      const formattedResults = results.map(result => ({
        content: result.document,
        score: result.score,
        metadata: result.metadata
      }));
      
      logger.info('RAG query successful', { 
        resultsCount: formattedResults.length,
        topScore: formattedResults[0]?.score
      });
      
      return formattedResults;
    } catch (err) {
      // Let framework errors pass through
      if (err instanceof ValidationError || 
          err instanceof EmbeddingError || 
          err instanceof DatabaseError || 
          err instanceof NotFoundError) {
        throw err;
      }
      
      // Wrap unexpected errors
      logger.error('Unexpected error in RAG query', { error: err });
      throw new InternalError('Unexpected error in RAG query', {
        cause: err,
        isOperational: false
      });
    }
  }
}

module.exports = RagSystem;
```

## Best Practices

1. **Use the Right Error Type**: Choose the most specific error type for the situation.

2. **Include Detailed Error Messages**: Error messages should clearly explain what went wrong.

3. **Add Context with Metadata**: Include relevant metadata with errors to aid debugging.

4. **Distinguish Operational and Programming Errors**:
   - **Operational Errors**: Expected errors that occur due to external factors (e.g., invalid input, API rate limits)
   - **Programming Errors**: Unexpected errors that indicate bugs in the code (e.g., null reference errors)

5. **Set Appropriate Error Codes**: Use semantic error codes that identify the specific error condition.

6. **Handle Errors at the Appropriate Level**: Catch errors at the level where you can handle them properly.

7. **Don't Expose Sensitive Information**: Sanitize error messages and metadata before returning them to clients.

8. **Log Error Details**: Use the logging system to log errors with appropriate log levels.

9. **Format Error Responses Consistently**: Use `errorHandler.formatErrorResponse()` for API responses.

10. **Wrap Async Functions**: Use `errorHandler.wrapAsync()` to ensure all errors are handled.

## Conclusion

The standardized error handling system provides a robust foundation for error handling in the Claude Neural Framework. By following these guidelines, you can ensure that your components integrate seamlessly with the rest of the framework and provide consistent error handling for easier debugging and better user experience.