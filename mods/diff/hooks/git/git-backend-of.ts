import type Backend from '../backend'
import Limits from '../limits'
import Argv from './argv'
import { FAILED_RUN } from './failed-run'
import { fetchDiff } from './fetch-diff'
import { fetchFileHunks } from './fetch-file-hunks'
import { GIT_BASE_MODES } from './git-base-modes'
import { GIT_WORDS } from './git-words'
import Probes from './probes'
import type Types from './types'

/**
 * The git backend over the session's directory: the repository read with
 * one `rev-parse` in that directory, then every child pinned to it.
 *
 * Each child runs with `--git-dir`, `--work-tree` and cwd the top, under
 * the C locale and the fetch's timeout (the built-in's execPinnedGit); the
 * first fetch reads the paths dirty then, once (Probes.dirtyPathsOf).
 *
 * @param host the bound host's runner and probes
 * @returns the backend, or null outside a git working tree
 */
export async function gitBackendOf(
  host: Backend.BackendHost,
): Promise<Backend.Backend | null> {
  const runOf =
    (pinned: Types.Repository | null): Types.GitRun =>
    async argv => {
      try {
        return await host.run(
          ['git', ...(pinned ? Argv.pinnedLeadOf(pinned) : []), ...argv],
          {
            timeoutMs: Limits.GIT_TIMEOUT_MS,
            env: Argv.GIT_CHILD_ENV,
            ...(pinned && { cwd: pinned.toplevel }),
          },
        )
      } catch {
        return FAILED_RUN
      }
    }

  const repository = await Probes.repositoryOf(runOf(null))

  if (!repository) {
    return null
  }

  const run = runOf(repository)

  let baseline: Promise<ReadonlySet<string> | null> | null = null

  const depsOf = (dirty: ReadonlySet<string> | null): Types.GitDeps => ({
    run,
    repository,
    mtimeOf: host.mtimeOf,
    entryKindsOf: host.entryKindsOf,
    sessionStartMs: host.sessionStartMsOf(),
    baseline: dirty,
    onBranchBase: host.onBranchBase,
  })

  return {
    repository,
    baseModes: GIT_BASE_MODES,
    words: GIT_WORDS,
    fetchDiff: async mode => {
      baseline ??= Probes.dirtyPathsOf(run)

      return fetchDiff(depsOf(await baseline), mode)
    },
    fetchFileHunks: (data, file) => fetchFileHunks(run, data, file),
    headKeyOf: () =>
      Probes.headKeyOf(
        { ...depsOf(null), readFile: host.readFile },
        repository,
      ),
  }
}
