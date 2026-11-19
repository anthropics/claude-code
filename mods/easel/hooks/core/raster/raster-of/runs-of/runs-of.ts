import type Types from '../../types'
import Words from '../../words'
import { runOf } from './run-of'

/**
 * A blank takes the ink of the run before it, which keeps the runs few.
 *
 * @param cells one row, as painted
 * @returns the runs of the row, without the blanks at its end
 */
export function runsOf(cells: readonly Types.CanvasCell[]): Types.Run[] {
  const runs: Types.Run[] = []

  for (const painted of cells.slice(
    0,
    cells.findLastIndex(cell => cell.glyph !== Words.BLANK) + 1,
  )) {
    const last = runs.at(-1)
    const isSameRun =
      last &&
      ((last.ink === painted.ink && last.background === painted.background) ||
        (painted.glyph === Words.BLANK && last.background === undefined))

    isSameRun ? (last.text += painted.glyph) : runs.push(runOf(painted))
  }

  return runs
}
