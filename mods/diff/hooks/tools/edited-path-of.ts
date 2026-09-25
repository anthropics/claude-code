import type { ToolCallInput } from 'claude-code'

/**
 * The file an editing tool was called on, as its input names it:
 * `file_path` for Edit and Write, `notebook_path` for NotebookEdit.
 *
 * @param e the `tool.call` event
 * @returns the path as given, or null when the input names none
 */
export function editedPathOf(e: ToolCallInput): string | null {
  const isFileEdit = e.tool === 'Edit' || e.tool === 'Write'
  const isNotebookEdit = e.tool === 'NotebookEdit'

  const path = isFileEdit
    ? e.file_path
    : isNotebookEdit
      ? e.notebook_path
      : null

  return typeof path === 'string' && path !== '' ? path : null
}
