/**
 * The engine's own instruction files, as it reads them in each directory of
 * its walk and under a read file.
 *
 * A directory holding one has project instructions the engine loads itself.
 */
export const CLAUDE_NAMES = [
  'CLAUDE.md',
  '.claude/CLAUDE.md',
  'CLAUDE.local.md',
] as const
