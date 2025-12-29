/**
 * CLI Command Parser
 *
 * Parses command line arguments and options for Claude Code.
 */

/**
 * CLI flag definitions
 */
const CLI_FLAGS = {
    // Authentication
    HELP: '--help',
    VERSION: '--version',

    // Mode flags
    PRINT: '--print',
    CONTINUE: '--continue',
    RESUME: '--resume',
    DANGEROUSLY_SKIP_PERMISSIONS: '--allow-dangerously-skip-permissions',

    // Model configuration
    MODEL: '--model',
    MAX_TOKENS: '--max-tokens',
    MAX_TURNS: '--max-turns',

    // System prompt
    SYSTEM_PROMPT: '--system-prompt',
    APPEND_SYSTEM_PROMPT: '--append-system-prompt',
    SYSTEM_PROMPT_FILE: '--system-prompt-file',
    APPEND_SYSTEM_PROMPT_FILE: '--append-system-prompt-file',

    // Tools
    ALLOWED_TOOLS: '--allowed-tools',
    DISALLOWED_TOOLS: '--disallowed-tools',
    MCP_CONFIG: '--mcp-config',

    // Input/Output
    INPUT_FORMAT: '--input-format',
    OUTPUT_FORMAT: '--output-format',
    VERBOSE: '--verbose',
    DEBUG: '--debug',

    // Session
    SESSION_ID: '--session-id',

    // Environment
    ENV: '-e',
    CWD: '--cwd'
};

/**
 * Short flag aliases
 */
const SHORT_FLAGS = {
    '-h': CLI_FLAGS.HELP,
    '-v': CLI_FLAGS.VERSION,
    '-p': CLI_FLAGS.PRINT,
    '-c': CLI_FLAGS.CONTINUE,
    '-r': CLI_FLAGS.RESUME,
    '-m': CLI_FLAGS.MODEL,
    '-e': CLI_FLAGS.ENV
};

/**
 * Flags that take a value
 */
const VALUE_FLAGS = new Set([
    CLI_FLAGS.MODEL,
    CLI_FLAGS.MAX_TOKENS,
    CLI_FLAGS.MAX_TURNS,
    CLI_FLAGS.SYSTEM_PROMPT,
    CLI_FLAGS.APPEND_SYSTEM_PROMPT,
    CLI_FLAGS.SYSTEM_PROMPT_FILE,
    CLI_FLAGS.APPEND_SYSTEM_PROMPT_FILE,
    CLI_FLAGS.ALLOWED_TOOLS,
    CLI_FLAGS.DISALLOWED_TOOLS,
    CLI_FLAGS.MCP_CONFIG,
    CLI_FLAGS.INPUT_FORMAT,
    CLI_FLAGS.OUTPUT_FORMAT,
    CLI_FLAGS.SESSION_ID,
    CLI_FLAGS.ENV,
    CLI_FLAGS.CWD
]);

/**
 * Flags that can appear multiple times
 */
const MULTI_FLAGS = new Set([
    CLI_FLAGS.ENV,
    CLI_FLAGS.ALLOWED_TOOLS,
    CLI_FLAGS.DISALLOWED_TOOLS
]);

/**
 * @typedef {Object} ParsedArgs
 * @property {boolean} help - Show help
 * @property {boolean} version - Show version
 * @property {boolean} print - Print mode
 * @property {boolean} continue - Continue last session
 * @property {string|null} resume - Resume specific session
 * @property {boolean} dangerouslySkipPermissions - Skip permission checks
 * @property {string|null} model - Model to use
 * @property {number|null} maxTokens - Max output tokens
 * @property {number|null} maxTurns - Max conversation turns
 * @property {string|null} systemPrompt - System prompt
 * @property {string|null} appendSystemPrompt - Appended system prompt
 * @property {string|null} systemPromptFile - System prompt file path
 * @property {string|null} appendSystemPromptFile - Appended system prompt file path
 * @property {string[]} allowedTools - Allowed tool names
 * @property {string[]} disallowedTools - Disallowed tool names
 * @property {string|null} mcpConfig - MCP config file path
 * @property {string|null} inputFormat - Input format
 * @property {string|null} outputFormat - Output format
 * @property {boolean} verbose - Verbose output
 * @property {boolean} debug - Debug mode
 * @property {string|null} sessionId - Session ID
 * @property {string[]} env - Environment variables
 * @property {string|null} cwd - Working directory
 * @property {string[]} positional - Positional arguments
 */

/**
 * Create default parsed args
 * @returns {ParsedArgs}
 */
function createDefaultArgs() {
    return {
        help: false,
        version: false,
        print: false,
        continue: false,
        resume: null,
        dangerouslySkipPermissions: false,
        model: null,
        maxTokens: null,
        maxTurns: null,
        systemPrompt: null,
        appendSystemPrompt: null,
        systemPromptFile: null,
        appendSystemPromptFile: null,
        allowedTools: [],
        disallowedTools: [],
        mcpConfig: null,
        inputFormat: null,
        outputFormat: null,
        verbose: false,
        debug: false,
        sessionId: null,
        env: [],
        cwd: null,
        positional: []
    };
}

/**
 * Normalize a flag (expand short flags)
 * @param {string} flag - Flag to normalize
 * @returns {string} - Normalized flag
 */
function normalizeFlag(flag) {
    return SHORT_FLAGS[flag] || flag;
}

/**
 * Parse command line arguments
 * @param {string[]} argv - Arguments to parse
 * @returns {ParsedArgs}
 */
function parseArgs(argv) {
    const args = createDefaultArgs();
    let i = 0;

    while (i < argv.length) {
        const arg = argv[i];

        // Check if it's a flag
        if (arg.startsWith('-')) {
            const flag = normalizeFlag(arg);

            // Handle flags with values
            if (VALUE_FLAGS.has(flag)) {
                const value = argv[++i];
                if (value === undefined) {
                    throw new Error(`Missing value for flag: ${arg}`);
                }

                switch (flag) {
                    case CLI_FLAGS.MODEL:
                        args.model = value;
                        break;
                    case CLI_FLAGS.MAX_TOKENS:
                        args.maxTokens = parseInt(value, 10);
                        break;
                    case CLI_FLAGS.MAX_TURNS:
                        args.maxTurns = parseInt(value, 10);
                        break;
                    case CLI_FLAGS.SYSTEM_PROMPT:
                        args.systemPrompt = value;
                        break;
                    case CLI_FLAGS.APPEND_SYSTEM_PROMPT:
                        args.appendSystemPrompt = value;
                        break;
                    case CLI_FLAGS.SYSTEM_PROMPT_FILE:
                        args.systemPromptFile = value;
                        break;
                    case CLI_FLAGS.APPEND_SYSTEM_PROMPT_FILE:
                        args.appendSystemPromptFile = value;
                        break;
                    case CLI_FLAGS.ALLOWED_TOOLS:
                        args.allowedTools.push(value);
                        break;
                    case CLI_FLAGS.DISALLOWED_TOOLS:
                        args.disallowedTools.push(value);
                        break;
                    case CLI_FLAGS.MCP_CONFIG:
                        args.mcpConfig = value;
                        break;
                    case CLI_FLAGS.INPUT_FORMAT:
                        args.inputFormat = value;
                        break;
                    case CLI_FLAGS.OUTPUT_FORMAT:
                        args.outputFormat = value;
                        break;
                    case CLI_FLAGS.SESSION_ID:
                        args.sessionId = value;
                        break;
                    case CLI_FLAGS.ENV:
                        args.env.push(value);
                        break;
                    case CLI_FLAGS.CWD:
                        args.cwd = value;
                        break;
                    case CLI_FLAGS.RESUME:
                        args.resume = value;
                        break;
                }
            } else {
                // Boolean flags
                switch (flag) {
                    case CLI_FLAGS.HELP:
                        args.help = true;
                        break;
                    case CLI_FLAGS.VERSION:
                        args.version = true;
                        break;
                    case CLI_FLAGS.PRINT:
                        args.print = true;
                        break;
                    case CLI_FLAGS.CONTINUE:
                        args.continue = true;
                        break;
                    case CLI_FLAGS.DANGEROUSLY_SKIP_PERMISSIONS:
                        args.dangerouslySkipPermissions = true;
                        break;
                    case CLI_FLAGS.VERBOSE:
                        args.verbose = true;
                        break;
                    case CLI_FLAGS.DEBUG:
                        args.debug = true;
                        break;
                    default:
                        // Unknown flag - add to positional
                        args.positional.push(arg);
                }
            }
        } else {
            // Positional argument
            args.positional.push(arg);
        }

        i++;
    }

    return args;
}

/**
 * Validate parsed arguments
 * @param {ParsedArgs} args - Parsed arguments
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateArgs(args) {
    const errors = [];

    if (args.maxTokens !== null && (isNaN(args.maxTokens) || args.maxTokens <= 0)) {
        errors.push('--max-tokens must be a positive number');
    }

    if (args.maxTurns !== null && (isNaN(args.maxTurns) || args.maxTurns <= 0)) {
        errors.push('--max-turns must be a positive number');
    }

    if (args.continue && args.resume) {
        errors.push('Cannot use both --continue and --resume');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get prompt from positional arguments
 * @param {ParsedArgs} args - Parsed arguments
 * @returns {string|null}
 */
function getPromptFromArgs(args) {
    if (args.positional.length === 0) {
        return null;
    }
    return args.positional.join(' ');
}

/**
 * Check if running in interactive mode
 * @param {ParsedArgs} args - Parsed arguments
 * @returns {boolean}
 */
function isInteractiveMode(args) {
    return !args.print && args.positional.length === 0;
}

export {
    CLI_FLAGS,
    SHORT_FLAGS,
    VALUE_FLAGS,
    MULTI_FLAGS,
    createDefaultArgs,
    normalizeFlag,
    parseArgs,
    validateArgs,
    getPromptFromArgs,
    isInteractiveMode
};
