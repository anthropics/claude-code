import type { Call } from './call.js'

/**
 * The file a call of Write, Edit or NotebookEdit changes, as the call spells it.
 *
 * @param call any call
 * @param none the answer for such a call with no path
 * @returns the path, or undefined for a call of another tool
 */
export function writtenPathOf({ tool, input }: Call, none?: string) {
  const isWriting = ['Write', 'Edit', 'NotebookEdit'].includes(tool)
  const path = isWriting ? (input.file_path ?? input.notebook_path) : undefined

  return typeof path === 'string' ? path : isWriting ? none : undefined
}
