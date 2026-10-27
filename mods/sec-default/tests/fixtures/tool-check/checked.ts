import type { Args } from 'claude-code'

/**
 * The question the engine puts to `tool.check`: may Bash run `echo x`.
 */
export const CHECKED: Args<'tool.check'> = {
  tool: 'Bash',
  input: { command: 'echo x' },
}

/**
 * The same question where a host answers the asks: the engine's `approver`,
 * which the released declarations do not name yet.
 */
export const CHECKED_BY_HOST: Args<'tool.check'> = Object.assign(
  { approver: 'host' },
  CHECKED,
)
