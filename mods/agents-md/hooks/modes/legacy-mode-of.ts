import type { Mode } from './types'

/**
 * Each value the option took under its old key, `projectInstructions`, and
 * the mode that keeps its meaning.
 */
const LEGACY_MODES: Readonly<Record<string, Mode>> = {
  none: 'managed-only',
  claude: 'claude-md',
  'agents-fallback': 'claude-md-or-agents-md',
  both: 'claude-md-and-agents-md',
}

/**
 * The mode a value stored under the old `projectInstructions` key keeps; a
 * value it never took reads as `claude-md`, which adds nothing, never as the
 * default, which loads AGENTS.md.
 *
 * COMPAT_BREAK(agents-md-project-instructions): drop the projectInstructions
 * mapping once stored settings have migrated.
 *
 * @param value the `projectInstructions` option as stored
 * @returns the mode it keeps, undefined when nothing is stored there
 */
export function legacyModeOf(value: unknown): Mode | undefined {
  if (value === undefined) {
    return undefined
  }

  return (
    (typeof value === 'string' ? LEGACY_MODES[value] : undefined) ?? 'claude-md'
  )
}
