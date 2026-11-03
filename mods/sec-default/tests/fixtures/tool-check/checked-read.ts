import type { Args } from 'claude-code'

/**
 * Another question the engine puts to `tool.check`: may Read read `notes`.
 */
export const CHECKED_READ: Args<'tool.check'> = {
  tool: 'Read',
  input: { file_path: 'notes' },
}
