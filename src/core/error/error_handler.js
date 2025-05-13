/**
 * Error Handling System for Claude Neural Framework
 * ================================================
 * 
 * Provides a standardized error handling framework with consistent error types,
 * error codes, and error handling strategies.
 */

const logger = require('../logging/logger').createLogger('error-handler');

/**
 * Base error class for all framework errors
 */
class FrameworkError extends Error {
  /**
   * Create a new framework error
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   * @param {string} options.code - Error code
   * @param {number} options.status - HTTP status code
   * @param {string} options.component - Framework component that raised the error
   * @param {Error} options.cause - Original error that caused this error
   * @param {Object} options.metadata - Additional metadata
   * @param {boolean} options.isOperational - Whether this is an operational error
   */
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'ERR_FRAMEWORK_UNKNOWN';
    this.status = options.status || 500;
    this.component = options.component || 'framework';
    this.cause = options.cause;
    this.metadata = options.metadata || {};
    this.isOperational = options.isOperational !== undefined ? options.isOperational : true;
    this.timestamp = new Date();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Convert error to JSON
   * 
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      component: this.component,
      cause: this.cause ? this.cause.message : undefined,
      metadata: this.metadata,
      isOperational: this.isOperational,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
  
  /**
   * Convert error to string
   * 
   * @returns {string} String representation of the error
   */
  toString() {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}

/**
 * Configuration error
 */
class ConfigurationError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_CONFIGURATION',
      status: options.status || 500,
      component: options.component || 'config',
      isOperational: true,
      ...options
    });
  }
}

/**
 * Validation error
 */
class ValidationError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_VALIDATION',
      status: options.status || 400,
      component: options.component || 'validation',
      isOperational: true,
      ...options
    });
    
    // Add validation errors
    this.validationErrors = options.validationErrors || [];
  }
  
  /**
   * Convert error to JSON
   * 
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors
    };
  }
}

/**
 * API error
 */
class ApiError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_API',
      status: options.status || 500,
      component: options.component || 'api',
      isOperational: true,
      ...options
    });
  }
}

/**
 * Authentication error
 */
class AuthenticationError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_AUTHENTICATION',
      status: options.status || 401,
      component: options.component || 'auth',
      isOperational: true,
      ...options
    });
  }
}

/**
 * Authorization error
 */
class AuthorizationError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_AUTHORIZATION',
      status: options.status || 403,
      component: options.component || 'auth',
      isOperational: true,
      ...options
    });
  }
}

/**
 * Resource not found error
 */
class NotFoundError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_NOT_FOUND',
      status: options.status || 404,
      component: options.component || 'resource',
      isOperational: true,
      ...options
    });
  }
}

/**
 * Database error
 */
class DatabaseError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_DATABASE',
      status: options.status || 500,
      component: options.component || 'database',
      isOperational: options.isOperational !== undefined ? options.isOperational : true,
      ...options
    });
  }
}

/**
 * External service error
 */
class ExternalServiceError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_EXTERNAL_SERVICE',
      status: options.status || 502,
      component: options.component || 'external',
      isOperational: true,
      ...options
    });
  }
}

/**
 * Rate limit error
 */
class RateLimitError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_RATE_LIMIT',
      status: options.status || 429,
      component: options.component || 'rate-limit',
      isOperational: true,
      ...options
    });
    
    // Add rate limit information
    this.retryAfter = options.retryAfter || 60;
  }
  
  /**
   * Convert error to JSON
   * 
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter
    };
  }
}

/**
 * Timeout error
 */
class TimeoutError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_TIMEOUT',
      status: options.status || 504,
      component: options.component || 'timeout',
      isOperational: true,
      ...options
    });
  }
}

/**
 * Internal error
 */
class InternalError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_INTERNAL',
      status: options.status || 500,
      component: options.component || 'internal',
      isOperational: false,
      ...options
    });
  }
}

/**
 * MCP error
 */
class McpError extends FrameworkError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_MCP',
      status: options.status || 500,
      component: options.component || 'mcp',
      isOperational: true,
      ...options
    });
  }
}

/**
 * Claude API error
 */
class ClaudeApiError extends ExternalServiceError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_CLAUDE_API',
      component: options.component || 'claude-api',
      ...options
    });
  }
}

/**
 * Error handler class
 */
class ErrorHandler {
  /**
   * Create a new error handler
   * 
   * @param {Object} options - Options
   * @param {Function} options.exitOnUnhandledRejection - Whether to exit on unhandled rejections
   * @param {Function} options.exitOnUncaughtException - Whether to exit on uncaught exceptions
   * @param {Function} options.exitWithStackTrace - Whether to print stack trace on exit
   * @param {Function} options.onError - Error handler function
   */
  constructor(options = {}) {
    this.exitOnUnhandledRejection = options.exitOnUnhandledRejection !== undefined ? 
      options.exitOnUnhandledRejection : true;
      
    this.exitOnUncaughtException = options.exitOnUncaughtException !== undefined ? 
      options.exitOnUncaughtException : true;
      
    this.exitWithStackTrace = options.exitWithStackTrace !== undefined ? 
      options.exitWithStackTrace : true;
      
    this.onError = options.onError || this.defaultErrorHandler.bind(this);
    
    // Register global error handlers
    this.registerGlobalHandlers();
  }
  
  /**
   * Register global error handlers
   * @private
   */
  registerGlobalHandlers() {
    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.handleError(error);
      
      if (this.exitOnUnhandledRejection) {
        this.exitProcess(1, error);
      }
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      
      this.handleError(error);
      
      if (this.exitOnUncaughtException) {
        this.exitProcess(1, error);
      }
    });
  }
  
  /**
   * Default error handler
   * 
   * @param {Error} error - Error to handle
   * @private
   */
  defaultErrorHandler(error) {
    // Log error
    if (error instanceof FrameworkError) {
      // Framework error
      if (error.isOperational) {
        // Operational error
        logger.error(error.message, {
          error: error.toJSON(),
          component: error.component,
          code: error.code
        });
      } else {
        // Programming or system error
        logger.fatal(error.message, {
          error: error.toJSON(),
          component: error.component,
          code: error.code,
          stack: error.stack
        });
      }
    } else {
      // Unknown error
      logger.fatal('Unknown error', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });
    }
  }
  
  /**
   * Handle error
   * 
   * @param {Error} error - Error to handle
   */
  handleError(error) {
    this.onError(error);
  }
  
  /**
   * Exit process
   * 
   * @param {number} code - Exit code
   * @param {Error} error - Error
   * @private
   */
  exitProcess(code, error) {
    // Log exit
    logger.fatal(`Process exiting with code ${code}`, {
      error: {
        message: error.message,
        name: error.name
      }
    });
    
    // Print stack trace
    if (this.exitWithStackTrace) {
      console.error(error.stack);
    }
    
    // Exit process
    process.exit(code);
  }
  
  /**
   * Create a formatted error response
   * 
   * @param {Error} error - Error to format
   * @param {boolean} includeStack - Whether to include stack trace
   * @returns {Object} Formatted error response
   */
  formatErrorResponse(error, includeStack = false) {
    if (error instanceof FrameworkError) {
      const response = {
        status: 'error',
        code: error.code,
        message: error.message
      };
      
      // Add validation errors
      if (error instanceof ValidationError && error.validationErrors.length > 0) {
        response.validationErrors = error.validationErrors;
      }
      
      // Add rate limit information
      if (error instanceof RateLimitError) {
        response.retryAfter = error.retryAfter;
      }
      
      // Add stack trace in development
      if (includeStack) {
        response.stack = error.stack;
      }
      
      return response;
    } else {
      // Unknown error
      return {
        status: 'error',
        code: 'ERR_INTERNAL',
        message: 'Internal server error'
      };
    }
  }
  
  /**
   * Wrap an async function with error handling
   * 
   * @param {Function} fn - Function to wrap
   * @returns {Function} Wrapped function
   */
  wrapAsync(fn) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error);
        throw error;
      }
    };
  }
}

/**
 * Create a new error type
 * 
 * @param {string} name - Error name
 * @param {string} defaultCode - Default error code
 * @param {number} defaultStatus - Default HTTP status code
 * @param {string} defaultComponent - Default component
 * @param {boolean} defaultIsOperational - Default isOperational flag
 * @returns {Class} New error class
 */
function createErrorType(name, defaultCode, defaultStatus = 500, defaultComponent = 'framework', defaultIsOperational = true) {
  return class extends FrameworkError {
    constructor(message, options = {}) {
      super(message, {
        code: options.code || defaultCode,
        status: options.status || defaultStatus,
        component: options.component || defaultComponent,
        isOperational: options.isOperational !== undefined ? options.isOperational : defaultIsOperational,
        ...options
      });
      this.name = name;
    }
  };
}

// Create singleton error handler
const errorHandler = new ErrorHandler();

// Export all error classes and error handler
module.exports = {
  ErrorHandler,
  errorHandler,
  FrameworkError,
  ConfigurationError,
  ValidationError,
  ApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  ExternalServiceError,
  RateLimitError,
  TimeoutError,
  InternalError,
  McpError,
  ClaudeApiError,
  createErrorType
};