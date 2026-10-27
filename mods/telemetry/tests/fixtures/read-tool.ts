import type { ToolCallArgs } from 'claude-code'

/**
 * A Read the model asks for, for the reaching plugin's tool.call hook.
 */
export const READ_TOOL: ToolCallArgs = { tool: 'Read', file_path: '/work/a' }
