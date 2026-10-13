import { isRecord } from '../is-record'
import type { OpenOutcome } from './open-outcome.js'

/**
 * Reads what `$.ui.open` resolved: an unplaced pane is withdrawn, unless the
 * reason starts `no-surface`, where the engine keeps it for a surface to come.
 *
 * An engine that resolves nothing, or never gives that reason, reads as
 * before: placed, or withdrawn.
 *
 * @param opened what the open resolved
 * @returns what the plugin does with the pane
 */
export function openOutcomeOf(opened: unknown): OpenOutcome {
  const isUnplaced = isRecord(opened) && opened.isPlaced === false

  if (!isUnplaced) {
    return 'placed'
  }

  const isUnseen =
    typeof opened.reason === 'string' && opened.reason.startsWith('no-surface')

  return isUnseen ? 'awaited' : 'withdrawn'
}
