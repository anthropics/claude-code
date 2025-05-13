/**
 * Error Handler Tests
 * 
 * Unit tests for the error handling module.
 */

// Import test helpers
const { mockConsole } = require('../../../utils/test-helpers');
const { createMockLogger } = require('../../../utils/mock-factories');

// Mock logger
jest.mock('../../../../core/logging/logger', () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    component: 'error-handler',
    child: jest.fn().mockReturnThis()
  };
  
  return {
    createLogger: jest.fn().mockReturnValue(mockLogger),
    logger: mockLogger
  };
});

// Import the module to test
const errorHandler = require('../../../../core/error/error_handler');

describe('Error Handler', () => {
  let mockLogger;
  let originalProcessListeners;
  
  // Setup
  beforeEach(() => {
    mockLogger = require('../../../../core/logging/logger').createLogger();
    
    // Save original process listeners
    originalProcessListeners = {
      uncaughtException: process.listeners('uncaughtException'),
      unhandledRejection: process.listeners('unhandledRejection')
    };
    
    // Remove existing listeners to avoid interference
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  // Teardown
  afterEach(() => {
    // Restore original process listeners
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    
    // Re-add original listeners
    originalProcessListeners.uncaughtException.forEach(listener => {
      process.on('uncaughtException', listener);
    });
    
    originalProcessListeners.unhandledRejection.forEach(listener => {
      process.on('unhandledRejection', listener);
    });
  });
  
  describe('Error classes', () => {
    test('FrameworkError should be an instance of Error', () => {
      const error = new errorHandler.FrameworkError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('FrameworkError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('ERR_FRAMEWORK_UNKNOWN');
      expect(error.status).toBe(500);
      expect(error.component).toBe('framework');
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });
    
    test('ConfigError should be an instance of FrameworkError', () => {
      const error = new errorHandler.ConfigError('Config error');
      expect(error).toBeInstanceOf(errorHandler.FrameworkError);
      expect(error.name).toBe('ConfigError');
      expect(error.code).toBe('ERR_CONFIG');
      expect(error.component).toBe('config');
    });
    
    test('MCPError should be an instance of FrameworkError', () => {
      const error = new errorHandler.MCPError('MCP error');
      expect(error).toBeInstanceOf(errorHandler.FrameworkError);
      expect(error.name).toBe('MCPError');
      expect(error.code).toBe('ERR_MCP');
      expect(error.component).toBe('mcp');
    });
    
    test('RAGError should be an instance of FrameworkError', () => {
      const error = new errorHandler.RAGError('RAG error');
      expect(error).toBeInstanceOf(errorHandler.FrameworkError);
      expect(error.name).toBe('RAGError');
      expect(error.code).toBe('ERR_RAG');
      expect(error.component).toBe('rag');
    });
    
    test('ValidationError should be an instance of FrameworkError', () => {
      const error = new errorHandler.ValidationError('Validation error', {
        field: 'username',
        constraint: 'required'
      });
      expect(error).toBeInstanceOf(errorHandler.FrameworkError);
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('ERR_VALIDATION');
      expect(error.component).toBe('validation');
      expect(error.metadata).toEqual({
        field: 'username',
        constraint: 'required'
      });
    });
    
    test('should support custom error options', () => {
      const cause = new Error('Underlying cause');
      const error = new errorHandler.FrameworkError('Custom error', {
        code: 'ERR_CUSTOM',
        status: 418,
        component: 'custom-component',
        cause,
        metadata: { custom: 'data' },
        isOperational: false
      });
      
      expect(error.code).toBe('ERR_CUSTOM');
      expect(error.status).toBe(418);
      expect(error.component).toBe('custom-component');
      expect(error.cause).toBe(cause);
      expect(error.metadata).toEqual({ custom: 'data' });
      expect(error.isOperational).toBe(false);
    });
  });
  
  describe('formatError method', () => {
    test('should format a FrameworkError for API response', () => {
      const error = new errorHandler.FrameworkError('Test error', {
        code: 'ERR_TEST',
        status: 400,
        component: 'test',
        metadata: { foo: 'bar' }
      });
      
      const formatted = errorHandler.formatError(error);
      
      expect(formatted).toEqual({
        error: {
          message: 'Test error',
          code: 'ERR_TEST',
          status: 400,
          component: 'test',
          metadata: { foo: 'bar' }
        }
      });
    });
    
    test('should format a regular Error for API response', () => {
      const error = new Error('Regular error');
      const formatted = errorHandler.formatError(error);
      
      expect(formatted).toEqual({
        error: {
          message: 'Regular error',
          code: 'ERR_UNKNOWN',
          status: 500
        }
      });
    });
    
    test('should format a string error for API response', () => {
      const formatted = errorHandler.formatError('String error');
      
      expect(formatted).toEqual({
        error: {
          message: 'String error',
          code: 'ERR_UNKNOWN',
          status: 500
        }
      });
    });
    
    test('should sanitize sensitive information', () => {
      const error = new errorHandler.FrameworkError('Error with API key', {
        metadata: {
          api_key: 'secret-key',
          password: 'password123',
          token: 'jwt-token',
          config: {
            credentials: {
              key: 'nested-secret'
            }
          }
        }
      });
      
      const formatted = errorHandler.formatError(error);
      
      expect(formatted.error.metadata.api_key).toBe('[REDACTED]');
      expect(formatted.error.metadata.password).toBe('[REDACTED]');
      expect(formatted.error.metadata.token).toBe('[REDACTED]');
      expect(formatted.error.metadata.config.credentials.key).toBe('[REDACTED]');
    });
  });
  
  describe('handleError method', () => {
    test('should log operational errors and return formatted error', () => {
      const error = new errorHandler.FrameworkError('Operational error', {
        isOperational: true,
        component: 'test-component'
      });
      
      const result = errorHandler.handleError(error);
      
      // Should log the error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Operational error occurred',
        expect.objectContaining({ error })
      );
      
      // Should return formatted error
      expect(result).toEqual(errorHandler.formatError(error));
    });
    
    test('should log programmer errors and return formatted error', () => {
      const error = new errorHandler.FrameworkError('Programmer error', {
        isOperational: false,
        component: 'test-component'
      });
      
      // Mock exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = jest.fn();
      
      try {
        const result = errorHandler.handleError(error);
        
        // Should log the error
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Programmer error occurred',
          expect.objectContaining({ error })
        );
        
        // Should return formatted error
        expect(result).toEqual(errorHandler.formatError(error));
        
        // Should not exit in test environment
        expect(process.exit).not.toHaveBeenCalled();
      } finally {
        // Restore original exit
        process.exit = originalExit;
      }
    });
  });
  
  describe('global error handlers', () => {
    test('should handle uncaught exceptions', () => {
      // Set up handler
      errorHandler.setupGlobalHandlers();
      
      // Mock handleError to prevent actual handling
      const originalHandleError = errorHandler.handleError;
      errorHandler.handleError = jest.fn();
      
      try {
        // Simulate uncaught exception
        const error = new Error('Uncaught exception');
        process.emit('uncaughtException', error);
        
        // Should call handleError
        expect(errorHandler.handleError).toHaveBeenCalledWith(error);
      } finally {
        // Restore original handleError
        errorHandler.handleError = originalHandleError;
      }
    });
    
    test('should handle unhandled rejections', () => {
      // Set up handler
      errorHandler.setupGlobalHandlers();
      
      // Mock handleError to prevent actual handling
      const originalHandleError = errorHandler.handleError;
      errorHandler.handleError = jest.fn();
      
      try {
        // Simulate unhandled rejection
        const reason = new Error('Unhandled rejection');
        const promise = Promise.reject(reason);
        process.emit('unhandledRejection', reason, promise);
        
        // Should call handleError
        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Unhandled rejection: Unhandled rejection'
          })
        );
      } finally {
        // Restore original handleError
        errorHandler.handleError = originalHandleError;
      }
    });
  });
  
  describe('createError method', () => {
    test('should create a specific error type from a string', () => {
      const configError = errorHandler.createError('Config error', 'ConfigError');
      expect(configError).toBeInstanceOf(errorHandler.ConfigError);
      expect(configError.message).toBe('Config error');
      
      const mcpError = errorHandler.createError('MCP error', 'MCPError');
      expect(mcpError).toBeInstanceOf(errorHandler.MCPError);
      expect(mcpError.message).toBe('MCP error');
    });
    
    test('should create a generic FrameworkError for unknown types', () => {
      const error = errorHandler.createError('Unknown error', 'UnknownError');
      expect(error).toBeInstanceOf(errorHandler.FrameworkError);
      expect(error.message).toBe('Unknown error');
    });
    
    test('should accept options for created errors', () => {
      const error = errorHandler.createError('Error with options', 'ConfigError', {
        status: 400,
        metadata: { test: true }
      });
      
      expect(error).toBeInstanceOf(errorHandler.ConfigError);
      expect(error.message).toBe('Error with options');
      expect(error.status).toBe(400);
      expect(error.metadata).toEqual({ test: true });
    });
  });
});