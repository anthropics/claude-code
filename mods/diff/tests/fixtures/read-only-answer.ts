import type { ResultOf } from 'claude-code'

/**
 * A shell tool's answer as the engine gives it for a command the tool holds
 * read-only (`ls`, `git status`): the result, and `isReadOnly` beside it.
 *
 * Built through Object.assign, since the declarations may not name the
 * field yet; the plugin reads it through a type that may lack it too.
 */
export const READ_ONLY_ANSWER: ResultOf['tool.call'] = Object.assign(
  { result: 'listed' },
  { isReadOnly: true as const },
)
