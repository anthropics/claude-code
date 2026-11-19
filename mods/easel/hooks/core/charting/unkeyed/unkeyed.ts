import { DEFAULT_INK } from '../default-ink'
import type Types from '../types'

/**
 * A series drawn alone needs nothing to tell it from others.
 */
export const UNKEYED: Types.SeriesIdentity = {
  key: '',
  ink: DEFAULT_INK,
}
