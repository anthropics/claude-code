import type CoreCall from '../../../../call'
import Texts from '../../../../texts'
import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * Names the measured columns only if the call did, or if no shared label can.
 *
 * @param measureNames the measured columns that may be named
 * @param request the chart that was asked for
 * @param reading the table as read, for what all its series share
 * @returns what the values measure, in words
 */
export function subjectOf(
  measureNames: string[],
  request: CoreCall.ChartRequest,
  reading: Types.TableReading,
): string {
  const hasTooManyNames = measureNames.length > Limits.MAX_NAMES_IN_HEADER
  const measures = hasTooManyNames
    ? Texts.counted(measureNames.length, 'column')
    : measureNames.join(', ')
  const isUnnamed = request.y === undefined

  return Texts.truncateMiddle(
    (isUnnamed ? reading.sharedLabels : [measures, ...reading.sharedLabels])
      .filter(word => word !== '')
      .join(' ') || measures,
    Limits.MAX_HEADER_WIDTH,
  )
}
