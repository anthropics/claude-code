import type Types from '../types'
import { SUFFIX_SIZES } from './suffix-sizes'

/**
 * Every known suffix, with the unit and size it stands for.
 */
export const UNIT_SUFFIXES: ReadonlyMap<string, Types.SuffixSize> = new Map(
  SUFFIX_SIZES.flatMap(([unit, sizes]) =>
    Object.entries(sizes).map(
      ([suffix, size]) => [suffix, { unit, size }] as const,
    ),
  ),
)
