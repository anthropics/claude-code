/**
 * Logging utilities
 *
 * Debug logging with category filtering and buffered file output.
 */

import { dirname, join } from 'path';
import { getConfigDirectory } from '../config/environment.js';
import { getFileSystemAdapter } from './fileSystem.js';

/**
 * Check if debug mode is enabled
 * @returns {boolean}
 */
function isDebugEnabled() {
    return (
        parseBooleanTruthy(process.env.DEBUG) ||
        parseBooleanTruthy(process.env.DEBUG_SDK) ||
        process.argv.includes('--debug') ||
        process.argv.includes('-d') ||
        isDebugToStderr() ||
        process.argv.some((arg) => arg.startsWith('--debug='))
    );
}

/**
 * Check if debug output should go to stderr
 * @returns {boolean}
 */
function isDebugToStderr() {
    return (
        process.argv.includes('--debug-to-stderr') ||
        process.argv.includes('-d2e')
    );
}

/**
 * Parse debug filter from command line arguments
 * @returns {object|null} - Filter configuration or null
 */
function parseDebugFilter() {
    const debugArg = process.argv.find((arg) => arg.startsWith('--debug='));

    if (!debugArg) {
        return null;
    }

    const filterString = debugArg.substring(8);
    return parseFilterString(filterString);
}

/**
 * Parse a filter string into include/exclude configuration
 * @param {string} filterString - Comma-separated filter categories
 * @returns {object|null} - Filter configuration
 */
function parseFilterString(filterString) {
    if (!filterString || filterString.trim() === '') {
        return null;
    }

    const categories = filterString
        .split(',')
        .map((cat) => cat.trim())
        .filter(Boolean);

    if (categories.length === 0) {
        return null;
    }

    const hasExclusions = categories.some((cat) => cat.startsWith('!'));
    const hasInclusions = categories.some((cat) => !cat.startsWith('!'));

    // Can't mix inclusions and exclusions
    if (hasExclusions && hasInclusions) {
        return null;
    }

    const normalizedCategories = categories.map((cat) =>
        cat.replace(/^!/, '').toLowerCase()
    );

    return {
        include: hasExclusions ? [] : normalizedCategories,
        exclude: hasExclusions ? normalizedCategories : [],
        isExclusive: hasExclusions
    };
}

/**
 * Extract categories from a log message
 * @param {string} message - Log message
 * @returns {string[]} - Extracted categories
 */
function extractLogCategories(message) {
    const categories = [];

    // Check for MCP server prefix
    const mcpMatch = message.match(/^MCP server ["']([^"']+)["']/);
    if (mcpMatch && mcpMatch[1]) {
        categories.push('mcp');
        categories.push(mcpMatch[1].toLowerCase());
    } else {
        // Check for category prefix before colon
        const prefixMatch = message.match(/^([^:[]+):/);
        if (prefixMatch && prefixMatch[1]) {
            categories.push(prefixMatch[1].trim().toLowerCase());
        }
    }

    // Check for bracketed category
    const bracketMatch = message.match(/^\[([^\]]+)]/);
    if (bracketMatch && bracketMatch[1]) {
        categories.push(bracketMatch[1].trim().toLowerCase());
    }

    // Check for statsig
    if (message.toLowerCase().includes('statsig event:')) {
        categories.push('statsig');
    }

    // Check for category after colon
    const colonMatch = message.match(/:\s*([^:]+?)(?:\s+(?:type|mode|status|event))?:/);
    if (colonMatch && colonMatch[1]) {
        const category = colonMatch[1].trim().toLowerCase();
        if (category.length < 30 && !category.includes(' ')) {
            categories.push(category);
        }
    }

    return Array.from(new Set(categories));
}

/**
 * Check if a message should be logged based on filter
 * @param {string} message - Log message
 * @param {object|null} filter - Filter configuration
 * @returns {boolean}
 */
function shouldLogMessage(message, filter) {
    if (!filter) {
        return true;
    }

    const categories = extractLogCategories(message);

    if (categories.length === 0) {
        return !filter.isExclusive;
    }

    if (filter.isExclusive) {
        return !categories.some((cat) => filter.exclude.includes(cat));
    }

    return categories.some((cat) => filter.include.includes(cat));
}

/**
 * Create a buffered writer for efficient file output
 * @param {object} options - Writer options
 * @returns {object} - Buffered writer
 */
function createBufferedWriter({
    writeFn,
    flushIntervalMs = 1000,
    maxBufferSize = 100,
    immediateMode = false
}) {
    let buffer = [];
    let flushTimeout = null;

    function clearFlushTimeout() {
        if (flushTimeout) {
            clearTimeout(flushTimeout);
            flushTimeout = null;
        }
    }

    function flush() {
        if (buffer.length === 0) {
            return;
        }

        writeFn(buffer.join(''));
        buffer = [];
        clearFlushTimeout();
    }

    function scheduleFlush() {
        if (!flushTimeout) {
            flushTimeout = setTimeout(flush, flushIntervalMs);
        }
    }

    return {
        write(data) {
            if (immediateMode) {
                writeFn(data);
                return;
            }

            buffer.push(data);
            scheduleFlush();

            if (buffer.length >= maxBufferSize) {
                flush();
            }
        },
        flush,
        dispose() {
            flush();
        }
    };
}

// Singleton debug writer
let debugWriter = null;

/**
 * Get the debug log file path
 * @param {string} sessionId - Session ID
 * @returns {string}
 */
function getDebugLogPath(sessionId) {
    return (
        process.env.CLAUDE_CODE_DEBUG_LOGS_DIR ??
        join(getConfigDirectory(), 'debug', `${sessionId}.txt`)
    );
}

/**
 * Log a debug message
 * @param {string} message - Message to log
 * @param {object} options - Logging options
 */
function logDebug(message, { level = 'debug' } = {}) {
    if (!isDebugEnabled()) {
        return;
    }

    const filter = parseDebugFilter();
    if (!shouldLogMessage(message, filter)) {
        return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    if (isDebugToStderr()) {
        process.stderr.write(formattedMessage);
        return;
    }

    // Write to file using buffered writer
    if (!debugWriter) {
        const fs = getFileSystemAdapter();
        debugWriter = createBufferedWriter({
            writeFn: (data) => {
                const logPath = getDebugLogPath('session'); // Would need session ID
                const logDir = dirname(logPath);
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir);
                }
                fs.appendFileSync(logPath, data, {});
            },
            flushIntervalMs: 1000,
            maxBufferSize: 100,
            immediateMode: isDebugEnabled()
        });
    }

    debugWriter.write(formattedMessage);
}

/**
 * Log an error for tracking
 * @param {Error} error - Error to log
 */
function logError(error) {
    logDebug(`ERROR: ${error.message}\n${error.stack}`, { level: 'error' });
}

export {
    isDebugEnabled,
    isDebugToStderr,
    parseDebugFilter,
    parseFilterString,
    extractLogCategories,
    shouldLogMessage,
    createBufferedWriter,
    getDebugLogPath,
    logDebug,
    logError
};
