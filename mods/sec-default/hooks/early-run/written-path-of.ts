import type { Call } from './call.js'

/**
 * The file a call of Write, Edit or NotebookEdit changes, as the call spells it.
 *
 * @param call any call
 * @returns the path, or undefined for a call of another tool
 */
export function writtenPathOf({ tool, input }: Call): string | undefined {
  const isWriting = ['Write', 'Edit', 'NotebookEdit'].includes(tool)
  const path = isWriting ? (input.file_path ?? input.notebook_path) : undefined

  return typeof path === 'string' ? path : undefined
}
