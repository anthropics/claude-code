/**
 * Terminal UI Utilities
 *
 * Functions for terminal output, colors, and user interaction.
 */

/**
 * ANSI color codes
 */
const COLORS = {
    // Reset
    RESET: '\x1b[0m',

    // Regular colors
    BLACK: '\x1b[30m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',

    // Bright colors
    BRIGHT_BLACK: '\x1b[90m',
    BRIGHT_RED: '\x1b[91m',
    BRIGHT_GREEN: '\x1b[92m',
    BRIGHT_YELLOW: '\x1b[93m',
    BRIGHT_BLUE: '\x1b[94m',
    BRIGHT_MAGENTA: '\x1b[95m',
    BRIGHT_CYAN: '\x1b[96m',
    BRIGHT_WHITE: '\x1b[97m',

    // Background colors
    BG_BLACK: '\x1b[40m',
    BG_RED: '\x1b[41m',
    BG_GREEN: '\x1b[42m',
    BG_YELLOW: '\x1b[43m',
    BG_BLUE: '\x1b[44m',
    BG_MAGENTA: '\x1b[45m',
    BG_CYAN: '\x1b[46m',
    BG_WHITE: '\x1b[47m'
};

/**
 * Text styles
 */
const STYLES = {
    BOLD: '\x1b[1m',
    DIM: '\x1b[2m',
    ITALIC: '\x1b[3m',
    UNDERLINE: '\x1b[4m',
    BLINK: '\x1b[5m',
    INVERSE: '\x1b[7m',
    HIDDEN: '\x1b[8m',
    STRIKETHROUGH: '\x1b[9m'
};

/**
 * Cursor control sequences
 */
const CURSOR = {
    HIDE: '\x1b[?25l',
    SHOW: '\x1b[?25h',
    HOME: '\x1b[H',
    UP: (n = 1) => `\x1b[${n}A`,
    DOWN: (n = 1) => `\x1b[${n}B`,
    RIGHT: (n = 1) => `\x1b[${n}C`,
    LEFT: (n = 1) => `\x1b[${n}D`,
    SAVE: '\x1b[s',
    RESTORE: '\x1b[u',
    CLEAR_LINE: '\x1b[2K',
    CLEAR_SCREEN: '\x1b[2J'
};

/**
 * Check if terminal supports colors
 * @returns {boolean}
 */
function supportsColor() {
    if (process.env.NO_COLOR) return false;
    if (process.env.FORCE_COLOR) return true;
    if (process.stdout && !process.stdout.isTTY) return false;
    if (process.env.TERM === 'dumb') return false;
    return true;
}

/**
 * Apply color to text
 * @param {string} text - Text to color
 * @param {string} color - Color code
 * @returns {string}
 */
function colorize(text, color) {
    if (!supportsColor()) return text;
    return `${color}${text}${COLORS.RESET}`;
}

/**
 * Apply style to text
 * @param {string} text - Text to style
 * @param {string} style - Style code
 * @returns {string}
 */
function stylize(text, style) {
    if (!supportsColor()) return text;
    return `${style}${text}${COLORS.RESET}`;
}

/**
 * Color helpers
 */
const color = {
    red: (text) => colorize(text, COLORS.RED),
    green: (text) => colorize(text, COLORS.GREEN),
    yellow: (text) => colorize(text, COLORS.YELLOW),
    blue: (text) => colorize(text, COLORS.BLUE),
    magenta: (text) => colorize(text, COLORS.MAGENTA),
    cyan: (text) => colorize(text, COLORS.CYAN),
    white: (text) => colorize(text, COLORS.WHITE),
    gray: (text) => colorize(text, COLORS.BRIGHT_BLACK),
    bold: (text) => stylize(text, STYLES.BOLD),
    dim: (text) => stylize(text, STYLES.DIM),
    italic: (text) => stylize(text, STYLES.ITALIC),
    underline: (text) => stylize(text, STYLES.UNDERLINE)
};

/**
 * Get terminal dimensions
 * @returns {{columns: number, rows: number}}
 */
function getTerminalSize() {
    return {
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 24
    };
}

/**
 * Clear the terminal screen
 */
function clearScreen() {
    process.stdout.write(CURSOR.CLEAR_SCREEN + CURSOR.HOME);
}

/**
 * Clear the current line
 */
function clearLine() {
    process.stdout.write(CURSOR.CLEAR_LINE + '\r');
}

/**
 * Move cursor up
 * @param {number} lines - Number of lines
 */
function cursorUp(lines = 1) {
    process.stdout.write(CURSOR.UP(lines));
}

/**
 * Hide cursor
 */
function hideCursor() {
    process.stdout.write(CURSOR.HIDE);
}

/**
 * Show cursor
 */
function showCursor() {
    process.stdout.write(CURSOR.SHOW);
}

/**
 * Create a simple spinner
 * @param {string} message - Spinner message
 * @returns {{start: function, stop: function, update: function}}
 */
function createSpinner(message) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;
    let intervalId = null;
    let currentMessage = message;

    return {
        start() {
            if (!supportsColor()) {
                process.stdout.write(currentMessage + '...\n');
                return;
            }

            hideCursor();
            intervalId = setInterval(() => {
                clearLine();
                process.stdout.write(`${color.cyan(frames[frameIndex])} ${currentMessage}`);
                frameIndex = (frameIndex + 1) % frames.length;
            }, 80);
        },

        stop(finalMessage, success = true) {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }

            clearLine();
            const symbol = success ? color.green('✓') : color.red('✗');
            process.stdout.write(`${symbol} ${finalMessage || currentMessage}\n`);
            showCursor();
        },

        update(newMessage) {
            currentMessage = newMessage;
        }
    };
}

/**
 * Create a progress bar
 * @param {number} total - Total value
 * @param {Object} options - Options
 * @returns {{update: function, complete: function}}
 */
function createProgressBar(total, options = {}) {
    const {
        width = 40,
        complete = '█',
        incomplete = '░',
        format = ':bar :percent :current/:total'
    } = options;

    let current = 0;

    function render() {
        const percent = Math.min(100, Math.floor((current / total) * 100));
        const filled = Math.floor((current / total) * width);
        const empty = width - filled;

        const bar = complete.repeat(filled) + incomplete.repeat(empty);
        const output = format
            .replace(':bar', bar)
            .replace(':percent', `${percent}%`.padStart(4))
            .replace(':current', String(current))
            .replace(':total', String(total));

        clearLine();
        process.stdout.write(output);
    }

    return {
        update(value) {
            current = Math.min(total, value);
            render();
        },

        increment(amount = 1) {
            current = Math.min(total, current + amount);
            render();
        },

        complete() {
            current = total;
            render();
            process.stdout.write('\n');
        }
    };
}

/**
 * Print a horizontal line
 * @param {string} char - Character to use
 * @param {number} [length] - Line length (defaults to terminal width)
 */
function printLine(char = '─', length) {
    const width = length || getTerminalSize().columns;
    console.log(char.repeat(width));
}

/**
 * Print a box around text
 * @param {string} text - Text to box
 * @param {Object} options - Options
 */
function printBox(text, options = {}) {
    const { padding = 1, borderColor = COLORS.CYAN } = options;
    const lines = text.split('\n');
    const maxLength = Math.max(...lines.map(l => l.length));
    const paddedWidth = maxLength + padding * 2;

    const horizontal = '─'.repeat(paddedWidth);
    const paddingStr = ' '.repeat(padding);

    console.log(colorize(`┌${horizontal}┐`, borderColor));
    for (const line of lines) {
        const paddedLine = line.padEnd(maxLength);
        console.log(colorize('│', borderColor) + paddingStr + paddedLine + paddingStr + colorize('│', borderColor));
    }
    console.log(colorize(`└${horizontal}┘`, borderColor));
}

export {
    COLORS,
    STYLES,
    CURSOR,
    supportsColor,
    colorize,
    stylize,
    color,
    getTerminalSize,
    clearScreen,
    clearLine,
    cursorUp,
    hideCursor,
    showCursor,
    createSpinner,
    createProgressBar,
    printLine,
    printBox
};
