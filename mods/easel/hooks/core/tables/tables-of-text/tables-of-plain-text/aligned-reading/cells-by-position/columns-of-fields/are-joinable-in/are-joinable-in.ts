import type Types from '../../../../../../types'
import { textsIn } from '../texts-in'
import { isAlignedAsOne } from './is-aligned-as-one'

/**
 * Two spans a single space apart can be one column cut by that space.
 *
 * @param rows the lines that are not rules, the first maybe a header
 * @param rules the lines that are rules
 * @returns the test of whether two spans, left then right, can be joined
 */
export const areJoinableIn =
  (rows: string[], rules: string[]) =>
  (left: Types.Field, right: Types.Field): boolean => {
    const joined = { from: left.from, until: right.until }

    return (
      left.until === right.from - 1 &&
      isAlignedAsOne(textsIn(rows, joined), textsIn(rules, joined))
    )
  }
