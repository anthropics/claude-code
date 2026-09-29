import type { Args } from 'claude-code'

/**
 * The question the engine puts to `tool.check`: may Bash run `echo x`.
 */
export const CHECKED: Args<'tool.check'> = {
  tool: 'Bash',
  input: { command: 'echo x' },
}
