import type { ResultOf } from 'claude-code'

/**
 * Whether a shell tool's outcome may have changed the working tree, as the
 * built-in gates its refresh: a throw or an answer, unless the engine says
 * the tool held the call read-only (`ls`, `git status`); never a deny.
 *
 * Without `isReadOnly`, the call counts as a write.
 *
 * @param result what `next` resolved to, or undefined when it threw
 * @returns true when a refresh is due
 */
export function mayHaveWritten(
  result: ResultOf['tool.call'] | undefined,
): boolean {
  return (
    result === undefined ||
    (result.deny === undefined && result.isReadOnly !== true)
  )
}
