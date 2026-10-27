import type { EventResult } from 'claude-code'

/**
 * The engine's verdict when the read block asked about a shell read outside
 * the working directories: the ask, its sentence, and the setting's key.
 */
export const SETTING_ASK: EventResult<'tool.check'> = {
  decision: 'ask',
  reason: 'cat names a path outside the working directories',
  setting: 'permissions.blockReadsOutsideWorkingDirectories',
}
