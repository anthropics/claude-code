import type { EventResult } from 'claude-code'

/**
 * The engine's verdict when a PreToolUse hook refused the call: the deny,
 * the hook's sentence, and the hook's event.
 */
export const HOOK_DENY: EventResult<'tool.check'> = {
  decision: 'deny',
  reason: 'no echo here',
  hook: 'PreToolUse',
}
