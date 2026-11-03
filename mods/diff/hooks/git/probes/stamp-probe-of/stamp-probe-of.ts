import type Types from '../../types'
import { kindWalkOf } from '../kind-walk-of'

/**
 * A StampProbe rooted at a directory: a fresh, bounded kind walk over it
 * and the host's timestamp probe.
 *
 * @param deps lists a directory, reads a timestamp
 * @param base the absolute directory the probe's paths are under
 * @param budget how many directories the walk may list
 * @returns the probe
 */
export const stampProbeOf = (
  deps: Pick<Types.GitDeps, 'entryKindsOf' | 'mtimeOf'>,
  base: string,
  budget: number,
): Types.StampProbe => ({
  walk: kindWalkOf(deps.entryKindsOf, base, budget),
  base,
  mtimeOf: deps.mtimeOf,
})
