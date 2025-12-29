/**
 * HTTP Client Utilities
 *
 * Low-level HTTP request helpers and utilities.
 */

/**
 * HTTP methods
 */
const HTTP_METHODS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    PATCH: 'PATCH',
    DELETE: 'DELETE',
    HEAD: 'HEAD',
    OPTIONS: 'OPTIONS'
};

/**
 * Common content types
 */
const CONTENT_TYPES = {
    JSON: 'application/json',
    FORM: 'application/x-www-form-urlencoded',
    MULTIPART: 'multipart/form-data',
    TEXT: 'text/plain',
    HTML: 'text/html',
    SSE: 'text/event-stream'
};

/**
 * @typedef {Object} RequestOptions
 * @property {string} method - HTTP method
 * @property {Object} [headers] - Request headers
 * @property {string|Object} [body] - Request body
 * @property {number} [timeout] - Timeout in milliseconds
 * @property {AbortSignal} [signal] - Abort signal
 */

/**
 * @typedef {Object} HttpResponse
 * @property {number} status - HTTP status code
 * @property {string} statusText - Status text
 * @property {Object} headers - Response headers
 * @property {*} body - Response body
 * @property {boolean} ok - Whether status is 2xx
 */

/**
 * Create request headers with defaults
 * @param {Object} [custom] - Custom headers
 * @returns {Object}
 */
function createHeaders(custom = {}) {
    return {
        'Content-Type': CONTENT_TYPES.JSON,
        'Accept': CONTENT_TYPES.JSON,
        ...custom
    };
}

/**
 * Parse response based on content type
 * @param {Response} response - Fetch response
 * @returns {Promise<*>}
 */
async function parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        return response.json();
    }

    if (contentType.includes('text/')) {
        return response.text();
    }

    return response.blob();
}

/**
 * Create timeout signal
 * @param {number} ms - Timeout in milliseconds
 * @returns {AbortSignal}
 */
function createTimeoutSignal(ms) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
}

/**
 * Combine multiple abort signals
 * @param {...AbortSignal} signals - Signals to combine
 * @returns {AbortSignal}
 */
function combineSignals(...signals) {
    const controller = new AbortController();

    for (const signal of signals) {
        if (!signal) continue;
        if (signal.aborted) {
            controller.abort();
            return controller.signal;
        }
        signal.addEventListener('abort', () => controller.abort());
    }

    return controller.signal;
}

/**
 * Check if error is an abort error
 * @param {Error} error - Error to check
 * @returns {boolean}
 */
function isAbortError(error) {
    return error.name === 'AbortError' ||
           error.message?.includes('aborted') ||
           error.code === 'ABORT_ERR';
}

/**
 * Check if error is a timeout error
 * @param {Error} error - Error to check
 * @returns {boolean}
 */
function isTimeoutError(error) {
    return error.name === 'TimeoutError' ||
           error.message?.includes('timeout') ||
           error.code === 'ETIMEDOUT';
}

/**
 * Check if error is a network error
 * @param {Error} error - Error to check
 * @returns {boolean}
 */
function isNetworkError(error) {
    return error.name === 'TypeError' ||
           error.message?.includes('fetch') ||
           error.code === 'ECONNREFUSED' ||
           error.code === 'ENOTFOUND' ||
           error.code === 'ECONNRESET';
}

/**
 * Build URL with query parameters
 * @param {string} baseUrl - Base URL
 * @param {Object} [params] - Query parameters
 * @returns {string}
 */
function buildUrl(baseUrl, params = {}) {
    const url = new URL(baseUrl);

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
        }
    }

    return url.toString();
}

/**
 * Encode form data
 * @param {Object} data - Data to encode
 * @returns {string}
 */
function encodeFormData(data) {
    return Object.entries(data)
        .map(([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
        )
        .join('&');
}

/**
 * Parse Server-Sent Events stream
 * @param {ReadableStream} stream - Response body stream
 * @param {function} onEvent - Event callback
 * @returns {Promise<void>}
 */
async function parseSSEStream(stream, onEvent) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');

            // Keep incomplete line in buffer
            buffer = lines.pop() || '';

            let eventType = 'message';
            let eventData = '';

            for (const line of lines) {
                if (line.startsWith('event:')) {
                    eventType = line.substring(6).trim();
                } else if (line.startsWith('data:')) {
                    eventData += line.substring(5).trim();
                } else if (line === '' && eventData) {
                    // Empty line signals end of event
                    try {
                        const parsed = JSON.parse(eventData);
                        onEvent({ type: eventType, data: parsed });
                    } catch {
                        onEvent({ type: eventType, data: eventData });
                    }
                    eventType = 'message';
                    eventData = '';
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * Retry configuration
 * @typedef {Object} RetryConfig
 * @property {number} maxRetries - Maximum retries
 * @property {number} baseDelay - Base delay in ms
 * @property {number} maxDelay - Maximum delay in ms
 * @property {function} shouldRetry - Function to determine if should retry
 */

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    shouldRetry: (error, response) => {
        if (isAbortError(error)) return false;
        if (isNetworkError(error)) return true;
        if (response?.status >= 500) return true;
        if (response?.status === 429) return true;
        return false;
    }
};

/**
 * Calculate delay for retry attempt
 * @param {number} attempt - Attempt number (0-indexed)
 * @param {RetryConfig} config - Retry config
 * @returns {number}
 */
function calculateRetryDelay(attempt, config = DEFAULT_RETRY_CONFIG) {
    const delay = config.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * delay;
    return Math.min(delay + jitter, config.maxDelay);
}

/**
 * Sleep for specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get retry-after header value in milliseconds
 * @param {Headers} headers - Response headers
 * @returns {number|null}
 */
function getRetryAfterMs(headers) {
    const retryAfter = headers.get('retry-after');
    if (!retryAfter) return null;

    // Check if it's a number (seconds)
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
        return seconds * 1000;
    }

    // Try to parse as date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
        return Math.max(0, date.getTime() - Date.now());
    }

    return null;
}

export {
    HTTP_METHODS,
    CONTENT_TYPES,
    createHeaders,
    parseResponse,
    createTimeoutSignal,
    combineSignals,
    isAbortError,
    isTimeoutError,
    isNetworkError,
    buildUrl,
    encodeFormData,
    parseSSEStream,
    DEFAULT_RETRY_CONFIG,
    calculateRetryDelay,
    sleep,
    getRetryAfterMs
};
