/**
 * Error Types and Handling
 *
 * Custom error classes and error handling utilities for Claude Code.
 */

/**
 * Error codes for categorization
 */
const ErrorCode = {
    // API Errors
    API_ERROR: 'api_error',
    AUTHENTICATION_ERROR: 'authentication_error',
    RATE_LIMIT_ERROR: 'rate_limit_error',
    INVALID_REQUEST_ERROR: 'invalid_request_error',
    OVERLOADED_ERROR: 'overloaded_error',

    // Network Errors
    NETWORK_ERROR: 'network_error',
    TIMEOUT_ERROR: 'timeout_error',
    CONNECTION_ERROR: 'connection_error',

    // Tool Errors
    TOOL_ERROR: 'tool_error',
    TOOL_NOT_FOUND: 'tool_not_found',
    TOOL_EXECUTION_ERROR: 'tool_execution_error',
    TOOL_PERMISSION_DENIED: 'tool_permission_denied',

    // File Errors
    FILE_NOT_FOUND: 'file_not_found',
    FILE_READ_ERROR: 'file_read_error',
    FILE_WRITE_ERROR: 'file_write_error',
    PATH_NOT_ALLOWED: 'path_not_allowed',

    // Validation Errors
    VALIDATION_ERROR: 'validation_error',
    INVALID_INPUT: 'invalid_input',
    MISSING_REQUIRED: 'missing_required',

    // Session Errors
    SESSION_ERROR: 'session_error',
    SESSION_EXPIRED: 'session_expired',

    // Internal Errors
    INTERNAL_ERROR: 'internal_error',
    UNKNOWN_ERROR: 'unknown_error'
};

/**
 * Base error class for Claude Code
 */
class ClaudeCodeError extends Error {
    /**
     * @param {string} message - Error message
     * @param {string} code - Error code
     * @param {Object} [details] - Additional details
     */
    constructor(message, code = ErrorCode.UNKNOWN_ERROR, details = {}) {
        super(message);
        this.name = 'ClaudeCodeError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();

        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Convert to JSON representation
     * @returns {Object}
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

/**
 * API-related errors
 */
class APIError extends ClaudeCodeError {
    /**
     * @param {string} message - Error message
     * @param {number} [statusCode] - HTTP status code
     * @param {Object} [details] - Additional details
     */
    constructor(message, statusCode, details = {}) {
        const code = APIError.getCodeFromStatus(statusCode);
        super(message, code, { ...details, statusCode });
        this.name = 'APIError';
        this.statusCode = statusCode;
    }

    /**
     * Get error code from HTTP status
     * @param {number} status - HTTP status code
     * @returns {string}
     */
    static getCodeFromStatus(status) {
        switch (status) {
            case 401:
                return ErrorCode.AUTHENTICATION_ERROR;
            case 429:
                return ErrorCode.RATE_LIMIT_ERROR;
            case 400:
                return ErrorCode.INVALID_REQUEST_ERROR;
            case 529:
                return ErrorCode.OVERLOADED_ERROR;
            default:
                if (status >= 500) return ErrorCode.API_ERROR;
                return ErrorCode.UNKNOWN_ERROR;
        }
    }

    /**
     * Check if error is retryable
     * @returns {boolean}
     */
    isRetryable() {
        return [
            ErrorCode.RATE_LIMIT_ERROR,
            ErrorCode.OVERLOADED_ERROR,
            ErrorCode.API_ERROR
        ].includes(this.code);
    }
}

/**
 * Tool execution errors
 */
class ToolError extends ClaudeCodeError {
    /**
     * @param {string} message - Error message
     * @param {string} toolName - Name of the tool
     * @param {Object} [details] - Additional details
     */
    constructor(message, toolName, details = {}) {
        super(message, ErrorCode.TOOL_ERROR, { ...details, toolName });
        this.name = 'ToolError';
        this.toolName = toolName;
    }
}

/**
 * File system errors
 */
class FileError extends ClaudeCodeError {
    /**
     * @param {string} message - Error message
     * @param {string} path - File path
     * @param {string} [code] - Error code
     * @param {Object} [details] - Additional details
     */
    constructor(message, path, code = ErrorCode.FILE_READ_ERROR, details = {}) {
        super(message, code, { ...details, path });
        this.name = 'FileError';
        this.path = path;
    }
}

/**
 * Validation errors
 */
class ValidationError extends ClaudeCodeError {
    /**
     * @param {string} message - Error message
     * @param {string} field - Field that failed validation
     * @param {*} value - Invalid value
     * @param {Object} [details] - Additional details
     */
    constructor(message, field, value, details = {}) {
        super(message, ErrorCode.VALIDATION_ERROR, { ...details, field, value });
        this.name = 'ValidationError';
        this.field = field;
        this.value = value;
    }
}

/**
 * Permission denied errors
 */
class PermissionError extends ClaudeCodeError {
    /**
     * @param {string} message - Error message
     * @param {string} resource - Resource that was denied
     * @param {string} operation - Operation that was denied
     * @param {Object} [details] - Additional details
     */
    constructor(message, resource, operation, details = {}) {
        super(message, ErrorCode.TOOL_PERMISSION_DENIED, { ...details, resource, operation });
        this.name = 'PermissionError';
        this.resource = resource;
        this.operation = operation;
    }
}

/**
 * Wrap an error in a ClaudeCodeError
 * @param {Error} error - Original error
 * @param {string} [code] - Error code
 * @returns {ClaudeCodeError}
 */
function wrapError(error, code = ErrorCode.UNKNOWN_ERROR) {
    if (error instanceof ClaudeCodeError) {
        return error;
    }

    const wrapped = new ClaudeCodeError(
        error.message || 'Unknown error',
        code,
        { originalError: error.name }
    );
    wrapped.stack = error.stack;
    return wrapped;
}

/**
 * Check if an error is a specific type
 * @param {Error} error - Error to check
 * @param {string} code - Error code to match
 * @returns {boolean}
 */
function isErrorCode(error, code) {
    return error instanceof ClaudeCodeError && error.code === code;
}

/**
 * Check if error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean}
 */
function isRetryableError(error) {
    if (error instanceof APIError) {
        return error.isRetryable();
    }

    if (error instanceof ClaudeCodeError) {
        return [
            ErrorCode.RATE_LIMIT_ERROR,
            ErrorCode.OVERLOADED_ERROR,
            ErrorCode.NETWORK_ERROR,
            ErrorCode.TIMEOUT_ERROR
        ].includes(error.code);
    }

    // Check for common retryable error messages
    const message = error.message?.toLowerCase() || '';
    return message.includes('timeout') ||
           message.includes('rate limit') ||
           message.includes('overloaded') ||
           message.includes('econnreset');
}

/**
 * Format error for display
 * @param {Error} error - Error to format
 * @param {boolean} [includeStack=false] - Include stack trace
 * @returns {string}
 */
function formatError(error, includeStack = false) {
    let message = error.message || 'Unknown error';

    if (error instanceof ClaudeCodeError) {
        message = `[${error.code}] ${message}`;
    }

    if (includeStack && error.stack) {
        message += `\n${error.stack}`;
    }

    return message;
}

/**
 * Create a user-friendly error message
 * @param {Error} error - Error to convert
 * @returns {string}
 */
function getUserFriendlyMessage(error) {
    if (error instanceof APIError) {
        switch (error.code) {
            case ErrorCode.AUTHENTICATION_ERROR:
                return 'Authentication failed. Please check your API key.';
            case ErrorCode.RATE_LIMIT_ERROR:
                return 'Rate limit exceeded. Please wait a moment and try again.';
            case ErrorCode.OVERLOADED_ERROR:
                return 'The API is currently overloaded. Please try again later.';
            default:
                return 'An API error occurred. Please try again.';
        }
    }

    if (error instanceof ToolError) {
        return `Tool "${error.toolName}" encountered an error: ${error.message}`;
    }

    if (error instanceof FileError) {
        return `File operation failed for "${error.path}": ${error.message}`;
    }

    if (error instanceof PermissionError) {
        return `Permission denied for ${error.operation} on ${error.resource}`;
    }

    return error.message || 'An unexpected error occurred.';
}

export {
    ErrorCode,
    ClaudeCodeError,
    APIError,
    ToolError,
    FileError,
    ValidationError,
    PermissionError,
    wrapError,
    isErrorCode,
    isRetryableError,
    formatError,
    getUserFriendlyMessage
};
