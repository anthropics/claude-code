import type { Host } from '../../host'

/**
 * How a marked feature went: fine, or degraded for a reason, with the
 * properties the built-in panel's mark carries beside it.
 *
 * The pane never marks `bad`: a failed fetch keeps the last good diff on
 * screen.
 */
export type MarkOutcome = ({ kind: 'ok' } | { kind: 'sad'; reason: string }) & {
  props?: Parameters<Host['mark']>[0]['props']
}
