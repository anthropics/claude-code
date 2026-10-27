import type Turns from '../../turns'
import type { HeaderTotals } from '../header-totals'

/**
 * A turn's header counts: its files and their summed lines; nothing falls
 * past a cap.
 *
 * @param turn the turn
 * @returns the counts
 */
export const turnTotalsOf = (turn: Turns.TurnDiff): HeaderTotals => ({
  filesCount: turn.files.length,
  linesAdded: turn.files.reduce((sum, file) => sum + file.added, 0),
  linesRemoved: turn.files.reduce((sum, file) => sum + file.removed, 0),
  notShown: 0,
})
