/**
 * API Client Configuration
 *
 * Environment variables and configuration for Anthropic API clients.
 */

/**
 * Anthropic API environment variable names
 */
const ANTHROPIC_ENV = {
    API_KEY: 'ANTHROPIC_API_KEY',
    AUTH_TOKEN: 'ANTHROPIC_AUTH_TOKEN',
    BASE_URL: 'ANTHROPIC_BASE_URL',
    MODEL: 'ANTHROPIC_MODEL',
    BETAS: 'ANTHROPIC_BETAS',
    LOG: 'ANTHROPIC_LOG',
    CUSTOM_HEADERS: 'ANTHROPIC_CUSTOM_HEADERS',

    // Default models
    DEFAULT_OPUS_MODEL: 'ANTHROPIC_DEFAULT_OPUS_MODEL',
    DEFAULT_SONNET_MODEL: 'ANTHROPIC_DEFAULT_SONNET_MODEL',
    DEFAULT_HAIKU_MODEL: 'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    SMALL_FAST_MODEL: 'ANTHROPIC_SMALL_FAST_MODEL',
    SMALL_FAST_MODEL_AWS_REGION: 'ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION',

    // Cloud provider configuration
    BEDROCK_BASE_URL: 'ANTHROPIC_BEDROCK_BASE_URL',
    VERTEX_BASE_URL: 'ANTHROPIC_VERTEX_BASE_URL',
    VERTEX_PROJECT_ID: 'ANTHROPIC_VERTEX_PROJECT_ID',
    FOUNDRY_API_KEY: 'ANTHROPIC_FOUNDRY_API_KEY',
    FOUNDRY_BASE_URL: 'ANTHROPIC_FOUNDRY_BASE_URL',
    FOUNDRY_RESOURCE: 'ANTHROPIC_FOUNDRY_RESOURCE'
};

/**
 * API endpoints
 */
const API_ENDPOINTS = {
    MESSAGES: '/v1/messages',
    COMPLETIONS: '/v1/complete'
};

/**
 * Default API configuration
 */
const DEFAULT_CONFIG = {
    baseUrl: 'https://api.anthropic.com',
    timeout: 120000,
    maxRetries: 3,
    retryDelay: 1000
};

/**
 * HTTP status codes
 */
const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};

/**
 * API error types
 */
const API_ERROR_TYPES = {
    AUTHENTICATION: 'authentication_error',
    RATE_LIMIT: 'rate_limit_error',
    INVALID_REQUEST: 'invalid_request_error',
    API_ERROR: 'api_error',
    OVERLOADED: 'overloaded_error',
    NETWORK: 'network_error',
    TIMEOUT: 'timeout_error'
};

/**
 * Get API key from environment
 * @returns {string|undefined} - API key
 */
function getApiKey() {
    return process.env[ANTHROPIC_ENV.API_KEY] || process.env[ANTHROPIC_ENV.AUTH_TOKEN];
}

/**
 * Get base URL from environment or default
 * @returns {string} - Base URL
 */
function getBaseUrl() {
    return process.env[ANTHROPIC_ENV.BASE_URL] || DEFAULT_CONFIG.baseUrl;
}

/**
 * Get configured model from environment
 * @returns {string|undefined} - Model ID
 */
function getConfiguredModel() {
    return process.env[ANTHROPIC_ENV.MODEL];
}

/**
 * Check if a cloud provider is configured
 * @returns {'bedrock'|'vertex'|'foundry'|null} - Provider name or null
 */
function getCloudProvider() {
    if (process.env[ANTHROPIC_ENV.BEDROCK_BASE_URL]) return 'bedrock';
    if (process.env[ANTHROPIC_ENV.VERTEX_BASE_URL] || process.env[ANTHROPIC_ENV.VERTEX_PROJECT_ID]) return 'vertex';
    if (process.env[ANTHROPIC_ENV.FOUNDRY_BASE_URL] || process.env[ANTHROPIC_ENV.FOUNDRY_API_KEY]) return 'foundry';
    return null;
}

/**
 * Parse custom headers from environment
 * @returns {Object} - Parsed headers
 */
function getCustomHeaders() {
    const headersStr = process.env[ANTHROPIC_ENV.CUSTOM_HEADERS];
    if (!headersStr) return {};

    try {
        return JSON.parse(headersStr);
    } catch {
        return {};
    }
}

/**
 * Parse beta features from environment
 * @returns {string[]} - Beta feature names
 */
function getBetaFeatures() {
    const betasStr = process.env[ANTHROPIC_ENV.BETAS];
    if (!betasStr) return [];

    return betasStr.split(',').map(b => b.trim()).filter(Boolean);
}

/**
 * Check if API logging is enabled
 * @returns {boolean} - Whether logging is enabled
 */
function isApiLoggingEnabled() {
    const logValue = process.env[ANTHROPIC_ENV.LOG];
    return logValue === 'true' || logValue === '1' || logValue === 'debug';
}

/**
 * Create default headers for API requests
 * @param {string} apiKey - API key
 * @returns {Object} - Headers object
 */
function createDefaultHeaders(apiKey) {
    const headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey
    };

    const betas = getBetaFeatures();
    if (betas.length > 0) {
        headers['anthropic-beta'] = betas.join(',');
    }

    return { ...headers, ...getCustomHeaders() };
}

/**
 * Determine if an error is retryable
 * @param {number} statusCode - HTTP status code
 * @param {string} errorType - Error type
 * @returns {boolean} - Whether to retry
 */
function isRetryableError(statusCode, errorType) {
    // Retry on rate limits, overload, and server errors
    if (statusCode === HTTP_STATUS.RATE_LIMITED) return true;
    if (statusCode === HTTP_STATUS.SERVICE_UNAVAILABLE) return true;
    if (statusCode >= 500) return true;
    if (errorType === API_ERROR_TYPES.OVERLOADED) return true;
    if (errorType === API_ERROR_TYPES.RATE_LIMIT) return true;
    return false;
}

/**
 * Calculate retry delay with exponential backoff
 * @param {number} attempt - Retry attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {number} - Delay in milliseconds
 */
function calculateRetryDelay(attempt, baseDelay = DEFAULT_CONFIG.retryDelay) {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 60000); // Cap at 60 seconds
}

export {
    ANTHROPIC_ENV,
    API_ENDPOINTS,
    DEFAULT_CONFIG,
    HTTP_STATUS,
    API_ERROR_TYPES,
    getApiKey,
    getBaseUrl,
    getConfiguredModel,
    getCloudProvider,
    getCustomHeaders,
    getBetaFeatures,
    isApiLoggingEnabled,
    createDefaultHeaders,
    isRetryableError,
    calculateRetryDelay
};
