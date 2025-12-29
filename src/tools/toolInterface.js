/**
 * Tool Interface Definitions
 *
 * Defines the common interface for all Claude Code tools.
 */

/**
 * @typedef {Object} ToolValidationResult
 * @property {boolean} result - Whether validation passed
 * @property {string} [message] - Error message if validation failed
 * @property {number} [errorCode] - Error code if validation failed
 */

/**
 * @typedef {Object} ToolPermissionResult
 * @property {boolean} allowed - Whether the tool is allowed to execute
 * @property {string} [reason] - Reason for denial if not allowed
 */

/**
 * @typedef {Object} ToolResultBlockParam
 * @property {string} tool_use_id - The ID of the tool use
 * @property {'tool_result'} type - Always 'tool_result'
 * @property {string} content - The result content
 */

/**
 * @typedef {Object} ToolInterface
 * @property {string} name - Tool name
 * @property {boolean} strict - Whether strict mode is enabled
 * @property {Object[]} input_examples - Example inputs for the tool
 * @property {function(): Promise<string>} description - Get tool description
 * @property {function(): string} userFacingName - Get display name
 * @property {function(Object): string} getToolUseSummary - Summarize tool usage
 * @property {function(): boolean} isEnabled - Check if tool is enabled
 * @property {Object} inputSchema - Zod schema for input validation
 * @property {Object} [outputSchema] - Zod schema for output validation
 * @property {function(): boolean} isConcurrencySafe - Check if tool can run concurrently
 * @property {function(): boolean} isReadOnly - Check if tool only reads data
 * @property {function(): {isSearch: boolean, isRead: boolean}} isSearchOrReadCommand - Categorize tool type
 * @property {function(Object): string} getPath - Get the path for the tool operation
 * @property {function(Object): Promise<ToolValidationResult>} validateInput - Validate input
 * @property {function(Object, Object): Promise<ToolPermissionResult>} checkPermissions - Check permissions
 * @property {function(): Promise<string>} prompt - Get prompt for the tool
 * @property {function(Object): Object} renderToolUseMessage - Render tool use message
 * @property {function(Object): Object} renderToolUseRejectedMessage - Render rejected message
 * @property {function(Object): Object} renderToolUseErrorMessage - Render error message
 * @property {function(Object): Object} renderToolUseProgressMessage - Render progress message
 * @property {function(Object): Object} renderToolResultMessage - Render result message
 * @property {function(Object, string): ToolResultBlockParam} mapToolResultToToolResultBlockParam - Map result
 * @property {function(Object, Object): Promise<Object>} call - Execute the tool
 */

/**
 * Tool categories for grouping and permissions
 */
const TOOL_CATEGORIES = {
    READ_ONLY: {
        name: 'Read-only tools',
        description: 'Tools that only read data without modifying anything'
    },
    EDIT: {
        name: 'Edit tools',
        description: 'Tools that can modify files and data'
    },
    SYSTEM: {
        name: 'System tools',
        description: 'Tools that interact with the system'
    },
    MCP: {
        name: 'MCP tools',
        description: 'Model Context Protocol tools'
    },
    MCP_DEFERRED: {
        name: 'MCP tools (deferred)',
        description: 'MCP tools with deferred loading'
    }
};

/**
 * Known tool names
 */
const TOOL_NAMES = {
    BASH: 'Bash',
    READ: 'Read',
    WRITE: 'Write',
    EDIT: 'Edit',
    MULTI_EDIT: 'MultiEdit',
    GLOB: 'Glob',
    GREP: 'Grep',
    LS: 'LS',
    TASK: 'Task',
    TASK_OUTPUT: 'TaskOutput',
    WEB_FETCH: 'WebFetch',
    WEB_SEARCH: 'WebSearch',
    TODO_READ: 'TodoRead',
    TODO_WRITE: 'TodoWrite',
    NOTEBOOK_READ: 'NotebookRead',
    NOTEBOOK_EDIT: 'NotebookEdit',
    ASK_USER: 'AskUserQuestion',
    LSP: 'LSP',
    KILL_SHELL: 'KillShell',
    ENTER_PLAN_MODE: 'EnterPlanMode',
    EXIT_PLAN_MODE: 'ExitPlanMode',
    SKILL: 'Skill'
};

/**
 * Directories to exclude from search operations
 */
const SEARCH_EXCLUDE_DIRS = [
    '.git',
    '.svn',
    '.hg',
    '.bzr'
];

/**
 * Maximum output length for bash commands
 */
const BASH_MAX_OUTPUT_LENGTH = 30000;

/**
 * Default maximum lines for file reading
 */
const READ_MAX_LINES = 2000;

/**
 * Default chunk size for output
 */
const OUTPUT_CHUNK_SIZE = 2000;

/**
 * Create a tool result block
 * @param {string} toolUseId - The tool use ID
 * @param {string} content - The result content
 * @returns {ToolResultBlockParam}
 */
function createToolResult(toolUseId, content) {
    return {
        tool_use_id: toolUseId,
        type: 'tool_result',
        content
    };
}

/**
 * Format pagination info for tool results
 * @param {number} [limit] - Result limit
 * @param {number} [offset] - Result offset
 * @returns {string} - Formatted pagination string
 */
function formatPagination(limit, offset) {
    if (!limit && !offset) return '';
    return `limit: ${limit}, offset: ${offset ?? 0}`;
}

/**
 * Truncate content to maximum length
 * @param {string} content - Content to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated content
 */
function truncateContent(content, maxLength = BASH_MAX_OUTPUT_LENGTH) {
    if (!content || content.length <= maxLength) {
        return content;
    }
    const truncated = content.substring(0, maxLength);
    const remainingLines = (content.substring(maxLength).match(/\n/g) || []).length;
    return `${truncated}\n... [${remainingLines} lines truncated] ...`;
}

export {
    TOOL_CATEGORIES,
    TOOL_NAMES,
    SEARCH_EXCLUDE_DIRS,
    BASH_MAX_OUTPUT_LENGTH,
    READ_MAX_LINES,
    OUTPUT_CHUNK_SIZE,
    createToolResult,
    formatPagination,
    truncateContent
};
