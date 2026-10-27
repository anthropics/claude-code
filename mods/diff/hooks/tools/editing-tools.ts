/**
 * The tools whose success means Claude changed a file: the pane's open
 * trigger and a refresh (fileHistory's `track` ops in the built-in).
 */
export const EDITING_TOOLS = ['Edit', 'Write', 'NotebookEdit'] as const
