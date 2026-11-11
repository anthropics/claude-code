import type { ToolInfo } from 'claude-code'

/**
 * A tool of the session's that the organization has no claim on.
 */
export const SPARE_TOOLS: readonly ToolInfo[] = [
  { name: 'NotebookEdit', description: 'Edits a notebook.', mcp: false },
]
