import type Git from '../../git'

/**
 * A stored or picked value as a base mode, or null when it names none.
 *
 * @param value what `$.store.get` returned or a Select carried
 * @returns the mode, or null
 */
export function baseModeOf(value: unknown): Git.BaseMode | null {
  const isMode =
    value === 'session' || value === 'uncommitted' || value === 'branch'

  return isMode ? value : null
}
