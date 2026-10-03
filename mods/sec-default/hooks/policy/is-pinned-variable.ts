import type { Settings } from 'claude-code'

/**
 * Whether managed policy pins an environment variable: its `env` sets the
 * name, in any case (some systems read `Path` and `PATH` as one variable).
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param name the variable a plugin would set or unset
 * @returns true when the organization set it
 */
export const isPinnedVariable = (policy: Settings, name: string) =>
  Object.keys(policy.env ?? {}).some(
    pinned => pinned.toUpperCase() === name.toUpperCase(),
  )
