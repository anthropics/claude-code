import type { EventResult } from 'claude-code'

/**
 * A deny that no settings rule decided (a settings hook's, a tool's own
 * check): it names no rule.
 */
export const PLAIN_DENY: EventResult<'tool.check'> = {
  decision: 'deny',
  reason: 'a PreToolUse hook refused it',
}
