import type { Mode } from './types'

/**
 * The mode an unset option reads as: AGENTS.md where the project has no
 * CLAUDE.md of its own, the engine's CLAUDE.md walk standing alone where it
 * has one.
 */
export const DEFAULT_MODE: Mode = 'claude-md-or-agents-md'
