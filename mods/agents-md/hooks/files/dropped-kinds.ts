import type { InstructionFileKind } from 'claude-code'

/**
 * The kinds `managed-only` drops: the project's checked-in and private
 * instruction files and the person's own; what it keeps is the organization's
 * and memory.
 */
export const DROPPED_KINDS: readonly InstructionFileKind[] = [
  'project',
  'local',
  'user',
]
