/**
 * Whether an `enabledPlugins` entry turns its plugin on: `true`, or a list
 * of version constraints, as the engine reads one.
 *
 * @param value the entry's value
 * @returns true when the entry turns the plugin on
 */
export const isEnabledEntry = (value: unknown): boolean =>
  value === true || Array.isArray(value)
