import type Types from '../../types'

/**
 * Tells whether a stat leaves the names their room past its end: the least
 * room for a stat that stands before the names, the reserved room after.
 *
 * @param basis the width past the key and the lane, which counts the first
 * @param leastNameWidth the room that a stat before the names must leave
 * @param reservedWidth the room that a stat after the names must leave
 * @returns the test of one stat's columns, by the stat's place
 */
export const isStatFitting =
  (basis: Types.LegendBasis, leastNameWidth: number, reservedWidth: number) =>
  (statColumn: Types.StatColumn, statIndex: number): boolean => {
    const isBeforeNames = statIndex < basis.lane.statsBeforeNames

    return (
      basis.widthPastKey - statColumn.end >=
      (isBeforeNames ? leastNameWidth : reservedWidth)
    )
  }
