import Lists from '../../lists'
import Shapes from '../../shapes'
import type Types from '../types'

/**
 * As many as there are inks: the largest series gets the first.
 */
export const SERIES_IDENTITIES: readonly Types.SeriesIdentity[] = Lists.zip(
  [...'abcdefgh'],
  Shapes.SERIES_INKS,
).map(([key, ink]) => ({
  key,
  ink,
}))
