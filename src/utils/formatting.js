/**
 * Message and content formatting utilities
 *
 * Functions for formatting output, errors, and messages for display.
 */

/**
 * Format an error for display
 * @param {Error} error - Error object
 * @param {boolean} includeStack - Whether to include stack trace
 * @returns {string} - Formatted error message
 */
function formatError(error, includeStack = false) {
    if (!error) return 'Unknown error';

    const message = error.message || String(error);
    if (!includeStack || !error.stack) {
        return message;
    }

    return `${message}\n${error.stack}`;
}

/**
 * Format a file path for display
 * @param {string} filePath - Full file path
 * @param {string} [basePath] - Base path to make relative
 * @returns {string} - Formatted path
 */
function formatFilePath(filePath, basePath) {
    if (!filePath) return '';
    if (!basePath) return filePath;

    if (filePath.startsWith(basePath)) {
        const relative = filePath.substring(basePath.length);
        return relative.startsWith('/') ? relative.substring(1) : relative;
    }
    return filePath;
}

/**
 * Format a number with thousands separators
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
function formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toLocaleString();
}

/**
 * Format bytes to human readable size
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Decimal places
 * @returns {string} - Formatted size
 */
function formatSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    if (typeof bytes !== 'number' || isNaN(bytes)) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

    return `${size} ${sizes[i]}`;
}

/**
 * Format duration in milliseconds to human readable
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
function formatDuration(ms) {
    if (typeof ms !== 'number' || isNaN(ms)) return '0ms';

    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.round((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    const hours = Math.floor(ms / 3600000);
    const minutes = Math.round((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
}

/**
 * Format a date to ISO string
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date
 */
function formatDate(date) {
    if (!date || !(date instanceof Date)) {
        return new Date().toISOString();
    }
    return date.toISOString();
}

/**
 * Format date difference to human readable
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date (defaults to now)
 * @returns {string} - Formatted difference
 */
function formatDateDifference(startDate, endDate = new Date()) {
    if (!startDate || !(startDate instanceof Date)) return 'unknown';

    const diffMs = endDate.getTime() - startDate.getTime();
    return formatDuration(Math.abs(diffMs));
}

/**
 * Pluralize a word based on count
 * @param {number} count - Item count
 * @param {string} singular - Singular form
 * @param {string} [plural] - Plural form (defaults to singular + 's')
 * @returns {string} - Formatted string with count
 */
function pluralize(count, singular, plural) {
    const word = count === 1 ? singular : (plural || `${singular}s`);
    return `${count} ${word}`;
}

/**
 * Truncate text to maximum length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add when truncated
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength, suffix = '...') {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Indent text by a number of spaces
 * @param {string} text - Text to indent
 * @param {number} spaces - Number of spaces
 * @returns {string} - Indented text
 */
function indentText(text, spaces = 2) {
    if (!text) return '';
    const indent = ' '.repeat(spaces);
    return text.split('\n').map(line => indent + line).join('\n');
}

/**
 * Wrap text at a maximum line width
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum line width
 * @returns {string} - Wrapped text
 */
function wrapText(text, maxWidth = 80) {
    if (!text) return '';

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        if (currentLine.length + word.length + 1 <= maxWidth) {
            currentLine += (currentLine ? ' ' : '') + word;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);

    return lines.join('\n');
}

/**
 * Strip ANSI escape codes from text
 * @param {string} text - Text with ANSI codes
 * @returns {string} - Clean text
 */
function stripAnsi(text) {
    if (!text) return '';
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Format a key-value pair for display
 * @param {string} key - Key name
 * @param {*} value - Value
 * @param {string} separator - Separator between key and value
 * @returns {string} - Formatted pair
 */
function formatKeyValue(key, value, separator = ': ') {
    return `${key}${separator}${value}`;
}

/**
 * Format an object as key-value lines
 * @param {Object} obj - Object to format
 * @param {string} separator - Key-value separator
 * @returns {string} - Formatted lines
 */
function formatObject(obj, separator = ': ') {
    if (!obj || typeof obj !== 'object') return '';

    return Object.entries(obj)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => formatKeyValue(key, value, separator))
        .join('\n');
}

export {
    formatError,
    formatFilePath,
    formatNumber,
    formatSize,
    formatDuration,
    formatDate,
    formatDateDifference,
    pluralize,
    truncateText,
    indentText,
    wrapText,
    stripAnsi,
    formatKeyValue,
    formatObject
};
