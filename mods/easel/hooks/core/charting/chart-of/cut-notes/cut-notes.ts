import Forms from '../../../forms'
import Limits from '../../limits'
import { namesOf } from '../../names-of'
import type Types from '../../types'
import { whatIsDrawnOf } from './what-is-drawn-of'

/**
 * Says how many series were left off, and which were kept.
 *
 * @param options what was cut, what is drawn alone, and the limits in force
 * @returns no note, one note, or two where the call asked past the limit
 */
export function cutNotes(options: Types.CutNotesOptions): string[] {
  const cutCount = options.cutSeries.length

  if (cutCount === 0) {
    return []
  }

  const isLikelySamples =
    options.form === 'bars' &&
    cutCount >= Limits.MANY_TIMES_MORE_CUT_THAN_DRAWN * options.drawnAloneCount
  const areNamesGiven = cutCount <= Limits.MAX_NAMES_IN_A_NOTE
  const cutNote =
    `${Forms.countedIn(options.form, cutCount)} ` +
    (options.isRestDrawnAsOne ? 'drawn as one' : 'not shown') +
    (areNamesGiven ? ` (${namesOf(options.cutSeries)})` : '') +
    `: ${whatIsDrawnOf(options.drawnAloneCount)} of ` +
    (options.drawnAloneCount + cutCount).toLocaleString('en-US') +
    (isLikelySamples ? '. For a distribution, pass counts per range' : '')
  const isAskedPastTheLimit =
    options.top !== undefined && options.top > options.formLimit

  return isAskedPastTheLimit
    ? [
        cutNote,
        `top ${options.top}: a chart draws at most ` +
          `${Forms.countedIn(options.form, options.formLimit)}` +
          (options.isRestDrawnAsOne ? ', and the rest as one' : ''),
      ]
    : [cutNote]
}
