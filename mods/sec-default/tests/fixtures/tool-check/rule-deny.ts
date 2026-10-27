import type { EventResult } from 'claude-code'

/**
 * The engine's verdict when a deny rule in some settings file matched the
 * call: the deny, its sentence, and the rule as written.
 */
export const RULE_DENY: EventResult<'tool.check'> = {
  decision: 'deny',
  reason: 'Permission to use Bash has been denied.',
  rule: 'Bash(echo *)',
}
