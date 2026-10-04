import { KNOWN_SHELLS } from './known-shells'

/**
 * The row's `shell`: the login shell's basename when the CLI's list knows
 * it, `other` when it does not, `none` when no shell is set.
 *
 * The path itself, which can name a person, never reaches a row.
 *
 * @param shellPath SHELL (or COMSPEC on Windows) as read
 * @returns the shell's name from the closed list
 */
export function shellOf(shellPath: string | undefined) {
  const base = (shellPath ?? '')
    .split(/[/\\]/)
    .at(-1)
    ?.toLowerCase()
    .replace(/\.exe$/, '')

  if (!shellPath) {
    return 'none'
  }

  return base !== undefined && KNOWN_SHELLS.includes(base) ? base : 'other'
}
