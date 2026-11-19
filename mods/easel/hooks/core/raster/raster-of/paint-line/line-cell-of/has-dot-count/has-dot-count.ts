import type Types from '../../../../types'
import { dotCountOf } from '../dot-count-of'

/**
 * Tells the lines that leave a given count of dots in a cell.
 *
 * @param count how many dots to look for
 * @returns the test of one line: whether its dots are that many
 */
export const hasDotCount =
  (count: number) =>
  (line: Types.LineBits): boolean =>
    dotCountOf(line.bits) === count
