import type { EventResult } from 'claude-code'

import type { RuleDeny } from './types'

/**
 * Whether a `tool.check` verdict is a deny that a settings rule decided: the
 * one verdict the plugins a person installs may not loosen.
 *
 * Any deny rule counts, whatever settings file it came from: a verdict
 * carries the rule as written and never where it was read from.
 *
 * @param verdict what a run of the chain settled on
 * @returns true for a deny that names the rule behind it
 */
export const isRuleDeny = (
  verdict: EventResult<'tool.check'>,
): verdict is RuleDeny =>
  verdict.decision === 'deny' && verdict.rule !== undefined
