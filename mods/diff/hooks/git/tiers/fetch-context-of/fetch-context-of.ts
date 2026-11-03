import Limits from '../../../limits'
import Probes from '../../probes'
import type Types from '../../types'

/**
 * The context every tier of a fetch shares: the host's pinned git, the
 * repository, the mode, and one stamp probe over the working tree's top.
 *
 * @param deps the host
 * @param mode the comparison asked for
 * @returns the context
 */
export const fetchContextOf = (
  deps: Types.GitDeps,
  mode: Types.BaseMode,
): Types.FetchContext => ({
  deps,
  run: deps.run,
  repository: deps.repository,
  mode,
  stamps: Probes.stampProbeOf(
    deps,
    deps.repository.toplevel,
    Limits.MAX_LISTED_DIRECTORIES,
  ),
})
