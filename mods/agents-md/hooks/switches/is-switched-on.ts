/**
 * The spellings an environment switch is on with, as the engine reads its own.
 */
const ON_SPELLINGS: ReadonlySet<string> = new Set(['1', 'true', 'yes', 'on'])

/**
 * Whether an environment variable's value turns a switch on, read the way the
 * engine reads its own switches: `1`, `true`, `yes` or `on`, any case, trimmed.
 *
 * @param value the variable's value, or undefined when it is unset
 * @returns whether the switch is on
 */
export const isSwitchedOn = (value: string | undefined): boolean =>
  value !== undefined && ON_SPELLINGS.has(value.trim().toLowerCase())
