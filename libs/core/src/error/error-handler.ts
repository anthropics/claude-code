import { createLogger } from "./logging/logger";

const logger = createLogger('error-handler');

/**
 * Error types
 */
export enum ErrorType {
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  TIMEOUT = 'timeout',
}

/**
 * Base error class for the Claude Neural Framework
 */
export class ClaudeError extends Error {
  public readonly type: ErrorType;
  public readonly details: Record<string, any>;
  public readonly statusCode: number;

  /**
   * Create a new Claude error
   * @param message Error message
   * @param type Error type
   * @param details Additional error details
   * @param statusCode HTTP status code
   */
  constructor(
    message: string, 
    type: ErrorType = ErrorType.INTERNAL, 
    details: Record<string, any> = {}, 
    statusCode: number = 500
  ) {
    super(message);
    this.name = 'ClaudeError';
    this.type = type;
    this.details = details;
    this.statusCode = statusCode;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert the error to a JSON object
   * @returns JSON representation of the error
   */
  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Validation error
 */
export class ValidationError extends ClaudeError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorType.VALIDATION, details, 400);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends ClaudeError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorType.NOT_FOUND, details, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends ClaudeError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorType.UNAUTHORIZED, details, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error
 */
export class ForbiddenError extends ClaudeError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorType.FORBIDDEN, details, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * External service error
 */
export class ExternalError extends ClaudeError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorType.EXTERNAL, details, 502);
    this.name = 'ExternalError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends ClaudeError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorType.TIMEOUT, details, 504);
    this.name = 'TimeoutError';
  }
}

/**
 * Handle an error
 * @param error Error to handle
 * @returns Formatted error response
 */
export function handleError(error: unknown): Record<string, any> {
  if (error instanceof ClaudeError) {
    logger.error(error.message, { 
      type: error.type, 
      details: error.details,
      stack: error.stack 
    });
    
    return {
      status: error.statusCode,
      body: {
        error: {
          type: error.type,
          message: error.message,
          details: error.details,
        },
      },
    };
  }
  
  // Handle unknown errors
  const unknownError = error instanceof Error 
    ? error 
    : new Error(String(error));
  
  logger.error('Unknown error occurred', { 
    message: unknownError.message,
    stack: unknownError.stack 
  });
  
  return {
    status: 500,
    body: {
      error: {
        type: ErrorType.INTERNAL,
        message: 'An unexpected error occurred',
        details: {
          message: unknownError.message,
        },
      },
    },
  };
}

/**
 * Error handler for Express/Connect middleware
 */
export function errorMiddleware(err: unknown, req: any, res: any, next: any): void {
  const { status, body } = handleError(err);
  res.status(status).json(body);
}

export default {
  ClaudeError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ExternalError,
  TimeoutError,
  handleError,
  errorMiddleware,
};