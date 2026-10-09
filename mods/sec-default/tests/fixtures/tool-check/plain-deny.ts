import type { EventResult } from 'claude-code'

/**
 * A deny no settings rule decided (a tool's own check, a setting that is no
 * rule, a plugin's answer): it names none.
 */
export const PLAIN_DENY: EventResult<'tool.check'> = {
  decision: 'deny',
  reason: 'echo is refused here',
}
