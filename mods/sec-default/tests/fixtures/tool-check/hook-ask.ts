import type { EventResult } from 'claude-code'

/**
 * The engine's verdict when a PreToolUse hook asked for a person: the ask,
 * the hook's sentence, and the hook's event.
 */
export const HOOK_ASK: EventResult<'tool.check'> = {
  decision: 'ask',
  reason: 'a person approves every echo',
  hook: 'PreToolUse',
}
