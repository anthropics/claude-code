import type { ResultOf } from 'claude-code'

/**
 * A shell tool's answer as the engine gives it for a command the tool holds
 * read-only (`ls`, `git status`): the result, and `isReadOnly` beside it.
 */
export const READ_ONLY_ANSWER: ResultOf['tool.call'] = {
  result: 'listed',
  isReadOnly: true,
}
