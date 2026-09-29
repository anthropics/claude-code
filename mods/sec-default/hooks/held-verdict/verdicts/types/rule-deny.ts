import type { EventResult } from 'claude-code'

/**
 * A `tool.check` deny that names the settings rule behind it.
 */
export type RuleDeny = EventResult<'tool.check'> & {
  readonly decision: 'deny'
  readonly rule: string
}
