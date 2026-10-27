import type { Settings } from 'claude-code'

/**
 * Whether the session checkpoints Claude's edits, read as the built-in
 * reads it: the setting on unless set false, the variable unset or falsy.
 *
 * The built-in panel opens on an edit only through a checkpoint, so with
 * checkpointing off its first-edit open never happens; `/diff` still opens.
 *
 * @param settings the merged settings (`$.settings.read()`)
 * @param disabling `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING` as `$.env.get`
 *   answers it
 * @returns false when either turns checkpointing off
 */
export const isCheckpointing = (
  settings: Settings,
  disabling: string | undefined,
): boolean =>
  settings.fileCheckpointingEnabled !== false &&
  !['1', 'true', 'yes', 'on'].includes((disabling ?? '').trim().toLowerCase())
