import Patterns from '../patterns'
import type Types from '../types'

/**
 * As in the host, the variable decides when it says yes or no, else the first
 * of the given tiers that has the setting: the caller passes managed,
 * --settings and user settings, never project or local.
 * A host that compiles the module in answers itself (Shell.Host.isReaderOn),
 * --ax-screen-reader included, and this function is not called.
 *
 * @param variable what the environment holds for the screen reader, if set
 * @param tiers settings sources, each as the host reads it alone; the first
 *   that has the setting wins
 * @returns whether charts are written for a screen reader
 */
export function isReaderOn(
  variable: string | undefined,
  tiers: readonly Types.SettingsRead[],
): boolean {
  const said = variable?.trim() ?? ''
  const isSaidOff = Patterns.FALSY.test(said)
  const setting = tiers.find(tier => tier.axScreenReader !== undefined)

  return isSaidOff
    ? false
    : Patterns.TRUTHY.test(said) || setting?.axScreenReader === true
}
