import type { EventResult } from 'claude-code'

/**
 * The engine's verdict when an ask rule in some settings file matched the
 * call: the ask, its sentence, and the rule as written.
 */
export const RULE_ASK: EventResult<'tool.check'> = {
  decision: 'ask',
  reason: 'Claude requested permissions to use Bash.',
  rule: 'Bash(echo *)',
}
