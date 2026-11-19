import Lists from '../../../../../lists'
import type Types from '../../../../types'

/**
 * Each distinct moment once, earliest first.
 *
 * @param group the readings to take the times of
 * @returns their times in milliseconds
 */
export const sortedTimesOf = (group: Types.CellReading[]): number[] =>
  Lists.distinct(group.map(reading => reading.ms)).toSorted(
    (left, right) => left - right,
  )
