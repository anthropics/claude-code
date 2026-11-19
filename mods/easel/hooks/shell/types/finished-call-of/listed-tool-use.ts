import type { ToolUseSummary } from 'claude-code'

/**
 * What a finished call is read from, of a tool use as the host lists it.
 *
 * They are the host's own fields, so a change of theirs fails the type check
 * here.
 */
export type ListedToolUse = Pick<
  ToolUseSummary,
  'tool_use_id' | 'tool' | 'input' | 'result' | 'text'
>
