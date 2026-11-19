import type CoreCall from '../../../../call'
import Lists from '../../../../lists'
import type Types from '../../../types'

/**
 * How rows that share a sample become one value. Summing where none is
 * named is no guess: `cellProblemIn` refuses rows that need one.
 */
export const COMBINERS: Readonly<
  Record<NonNullable<CoreCall.ChartRequest['combine']>, Types.Combiner>
> = {
  sum: Lists.sumOf,
  mean: values => Lists.sumOf(values) / values.length,
  max: values => Math.max(...values),
  min: values => Math.min(...values),
}
