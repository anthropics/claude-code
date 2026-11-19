import { isText } from '../../../../../../is-text'
import type Types from '../../../../../../types'
import { textsIn } from '../texts-in'

/**
 * A column of texts holds a text under its first line.
 *
 * @param rows the lines that are not rules, the first maybe a header
 * @returns the test of whether a span holds a text under the first line
 */
export const hasTextIn =
  (rows: string[]) =>
  (field: Types.Field): boolean =>
    textsIn(rows, field).slice(1).some(isText)
