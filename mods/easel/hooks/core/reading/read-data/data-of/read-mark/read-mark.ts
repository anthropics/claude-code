import Cells from '../../../../cells'
import type Types from '../../../types'

/**
 * A mark is drawn only on a time axis, inside the times drawn.
 *
 * @param options the mark as asked, the form drawn and the span of its axis
 * @returns the mark, or the note that says why it is not drawn
 */
export function readMark(options: Types.MarkOptions): Types.Mark | string {
  const label = options.mark.label === undefined ? '' : options.mark.label
  const time = Cells.readTime(options.mark.at)
  const notDrawn =
    `${label === '' ? 'mark' : `mark ${label}`} at ${options.mark.at} not ` +
    `drawn:`

  const hasTimes = options.drawnForm !== 'bars' && options.drawnForm !== 'share'

  if (!hasTimes) {
    return `${notDrawn} it has no times`
  }

  if (options.drawnForm === 'sparks') {
    return `${notDrawn} sparks have no time axis`
  }

  const isTime = time.kind === 'time'

  if (!isTime) {
    return `${notDrawn} ${time.why}`
  }

  const isOutsideTheTimes =
    time.ms < options.axisSpan.fromMs || time.ms > options.axisSpan.untilMs

  if (isOutsideTheTimes) {
    return `${notDrawn} outside the times drawn`
  }

  const isZonedUnlikeTheTimes = time.isZoned !== options.isZoned

  return isZonedUnlikeTheTimes
    ? `${notDrawn} name a zone in both the mark and the times, or in ` +
        `neither`
    : { ms: time.ms, label }
}
