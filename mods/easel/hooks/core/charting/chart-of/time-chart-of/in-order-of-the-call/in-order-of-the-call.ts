import type CoreCall from '../../../../call'
import type Reading from '../../../../reading'
import type Types from '../../../types'

/**
 * Applies where the call names a `y` column for each series and all are drawn.
 * Any other order would come from the rows, which must not pick a key.
 *
 * @param groups the series of each plot
 * @param data what was read
 * @param request what the call asked for
 * @returns the groups and their series, ordered as the call names them
 */
export function inOrderOfTheCall(
  groups: Types.SizedSeries[][],
  data: Reading.Data,
  request: CoreCall.ChartRequest,
): Types.SizedSeries[][] {
  const names = data.series.map(series => series.name)
  const yNames = (request.y ?? []).map(name => name.toLowerCase())
  const isEachSeriesNamed =
    names.length > 1 &&
    names.every(name => yNames.includes(name.toLowerCase())) &&
    groups.flat().length === names.length

  if (!isEachSeriesNamed) {
    return groups
  }

  const indexOf = (series: Reading.Series): number => names.indexOf(series.name)
  const firstIndexIn = (group: Reading.Series[]): number =>
    Math.min(...group.map(indexOf))

  return groups
    .map(group =>
      group.toSorted((first, second) => indexOf(first) - indexOf(second)),
    )
    .toSorted((first, second) => firstIndexIn(first) - firstIndexIn(second))
}
