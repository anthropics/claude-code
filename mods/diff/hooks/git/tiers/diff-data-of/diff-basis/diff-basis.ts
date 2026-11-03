import type Types from '../../../types'

/**
 * What a tier decided about its diff besides the rows: what it compares,
 * the ref the hunks read against, whether HEAD is unborn, stale bodies.
 */
export type DiffBasis = {
  source: Types.DiffSource
  baseRef: string
  isUnborn: boolean
  stalePaths: readonly string[]
}
