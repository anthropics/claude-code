import Lists from '../../../../lists'
import type Refusal from '../../../../refusal'
import type Types from '../../../types'

/**
 * Refuses a form that the values cannot take: a share, a log scale or columns.
 *
 * @param options the roles, the call, the series and their timeline
 * @returns the reason to refuse, or undefined
 */
export function formProblemIn({
  roles,
  request,
  series,
  timeline,
}: Types.FormProblemOptions): Refusal.Problem | undefined {
  const values = series.flatMap(oneSeries =>
    oneSeries.samples.map(sample => sample.value ?? 0),
  )
  const hasNegative = values.some(value => value < 0)
  const isShareOfUnsummedRows =
    request.form === 'share' && request.combine !== 'sum'

  if (isShareOfUnsummedRows) {
    return {
      code: 'share_not_summed',
      why:
        'a share is the parts of a whole, which add up. Leave combine ' +
        'out, or draw bars',
    }
  }

  const isShareOfBrokenWhole =
    request.form === 'share' && (hasNegative || Lists.sumOf(values) <= 0)

  if (isShareOfBrokenWhole) {
    return {
      code: 'share_not_whole',
      why:
        'the parts of a whole are at or above zero and add up to more. ' +
        'Draw bars',
    }
  }

  const isLogOffALine =
    request.log === true && (request.form ?? roles.form) !== 'line'

  if (isLogOffALine) {
    return {
      code: 'log_not_line',
      why:
        'only a line has a log scale: all else stands on zero, which a ' +
        'log scale does not have. Draw a line',
    }
  }

  const isColumnOfUnevenStep =
    roles.form === 'columns' && timeline.periodStarts.length === 0

  if (isColumnOfUnevenStep) {
    return {
      code: 'uneven_step',
      why:
        `the times of ${roles.x} keep no even step (that takes two or ` +
        `more, with few gaps), so a column cannot stand for a period. Rows ` +
        `are not put in buckets of time: pass one row for each period, ` +
        `or draw a line, or pass zone: "local" if the periods are local ` +
        `days`,
    }
  }

  const isColumnBelowZero = roles.form === 'columns' && hasNegative

  return isColumnBelowZero
    ? {
        code: 'column_below_zero',
        why: 'a column stands on zero and a value is below zero. Draw a line',
      }
    : undefined
}
