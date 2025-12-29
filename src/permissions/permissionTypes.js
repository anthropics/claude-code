/**
 * Permission Types and Constants
 *
 * Defines permission modes, contexts, and utilities for tool access control.
 */

/**
 * Permission modes for tool execution
 */
const PermissionMode = {
    /** Always allow without prompting */
    ALWAYS_ALLOW: 'always_allow',
    /** Allow for this session only */
    SESSION_ALLOW: 'session_allow',
    /** Ask user each time */
    ASK: 'ask',
    /** Deny execution */
    DENY: 'deny',
    /** Allow once */
    ALLOW_ONCE: 'allow_once'
};

/**
 * Permission decision results
 */
const PermissionDecision = {
    ALLOWED: 'allowed',
    DENIED: 'denied',
    PENDING: 'pending',
    REQUIRES_APPROVAL: 'requires_approval'
};

/**
 * Tool permission categories
 */
const ToolPermissionCategory = {
    /** Read-only operations */
    READ: 'read',
    /** Write/modify operations */
    WRITE: 'write',
    /** System command execution */
    EXECUTE: 'execute',
    /** Network access */
    NETWORK: 'network',
    /** File system access */
    FILESYSTEM: 'filesystem'
};

/**
 * @typedef {Object} PermissionContext
 * @property {string} toolName - Name of the tool requesting permission
 * @property {string} operation - The operation being performed
 * @property {string} [path] - File path if applicable
 * @property {string} [command] - Command if applicable
 * @property {string} [url] - URL if applicable
 * @property {Object} [metadata] - Additional context
 */

/**
 * @typedef {Object} PermissionRule
 * @property {string} pattern - Pattern to match (glob or regex)
 * @property {string} mode - Permission mode
 * @property {string} [reason] - Reason for the rule
 */

/**
 * @typedef {Object} PermissionResult
 * @property {boolean} allowed - Whether permission is granted
 * @property {string} decision - The decision type
 * @property {string} [reason] - Reason for the decision
 * @property {boolean} [shouldPersist] - Whether to persist this decision
 */

/**
 * Default permission settings
 */
const DEFAULT_PERMISSIONS = {
    // Read operations are generally safe
    read: PermissionMode.ALWAYS_ALLOW,
    // Write operations require approval
    write: PermissionMode.ASK,
    // Execute requires explicit approval
    execute: PermissionMode.ASK,
    // Network access requires approval
    network: PermissionMode.ASK
};

/**
 * Paths that are always allowed for reading
 */
const ALWAYS_READABLE_PATHS = [
    'package.json',
    'tsconfig.json',
    'README.md',
    '.gitignore',
    '.eslintrc*',
    '.prettierrc*'
];

/**
 * Paths that should never be modified
 */
const PROTECTED_PATHS = [
    '.git/config',
    '.git/hooks/*',
    '.ssh/*',
    '.gnupg/*',
    '.env',
    '.env.local',
    '*.pem',
    '*.key',
    'credentials.json',
    'secrets.json'
];

/**
 * Commands that require elevated permissions
 */
const ELEVATED_COMMANDS = [
    'sudo',
    'su',
    'rm -rf',
    'chmod',
    'chown',
    'kill',
    'pkill',
    'shutdown',
    'reboot'
];

/**
 * Check if a path matches a pattern
 * @param {string} path - Path to check
 * @param {string} pattern - Pattern (supports * and ** globs)
 * @returns {boolean}
 */
function pathMatchesPattern(path, pattern) {
    if (!path || !pattern) return false;

    // Convert glob pattern to regex
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
}

/**
 * Check if a path is in the protected list
 * @param {string} path - Path to check
 * @returns {boolean}
 */
function isProtectedPath(path) {
    if (!path) return false;
    return PROTECTED_PATHS.some(pattern => pathMatchesPattern(path, pattern));
}

/**
 * Check if a path is always readable
 * @param {string} path - Path to check
 * @returns {boolean}
 */
function isAlwaysReadable(path) {
    if (!path) return false;
    return ALWAYS_READABLE_PATHS.some(pattern => pathMatchesPattern(path, pattern));
}

/**
 * Check if a command requires elevated permissions
 * @param {string} command - Command to check
 * @returns {boolean}
 */
function requiresElevatedPermissions(command) {
    if (!command) return false;
    const normalizedCmd = command.toLowerCase().trim();
    return ELEVATED_COMMANDS.some(elevated =>
        normalizedCmd.startsWith(elevated) || normalizedCmd.includes(` ${elevated}`)
    );
}

/**
 * Create a permission context
 * @param {string} toolName - Tool name
 * @param {string} operation - Operation type
 * @param {Object} [options] - Additional options
 * @returns {PermissionContext}
 */
function createPermissionContext(toolName, operation, options = {}) {
    return {
        toolName,
        operation,
        path: options.path,
        command: options.command,
        url: options.url,
        metadata: options.metadata || {}
    };
}

/**
 * Create a permission result
 * @param {boolean} allowed - Whether allowed
 * @param {string} decision - Decision type
 * @param {Object} [options] - Additional options
 * @returns {PermissionResult}
 */
function createPermissionResult(allowed, decision, options = {}) {
    return {
        allowed,
        decision,
        reason: options.reason,
        shouldPersist: options.shouldPersist ?? false
    };
}

export {
    PermissionMode,
    PermissionDecision,
    ToolPermissionCategory,
    DEFAULT_PERMISSIONS,
    ALWAYS_READABLE_PATHS,
    PROTECTED_PATHS,
    ELEVATED_COMMANDS,
    pathMatchesPattern,
    isProtectedPath,
    isAlwaysReadable,
    requiresElevatedPermissions,
    createPermissionContext,
    createPermissionResult
};
