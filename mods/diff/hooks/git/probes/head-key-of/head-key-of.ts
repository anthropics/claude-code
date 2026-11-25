import Limits from '../../../limits'
import Argv from '../../argv'
import type Types from '../../types'
import { isSafeRefName } from '../is-safe-ref-name'
import { listedStampOf } from '../listed-stamp-of'
import { stampProbeOf } from '../stamp-probe-of'

/**
 * A string that changes when HEAD moves: HEAD's text and the timestamps
 * of HEAD, its ref file and packed-refs, each a listed real file. A move
 * that lands between two of one key's reads is in the next key.
 *
 * A `ref:` outside the safe refname grammar is dated by HEAD's own log, the
 * listed real file `logs/HEAD`; without one, or where HEAD is not a plain
 * file, `git rev-parse` answers instead.
 *
 * @param deps git, listings, timestamps, a file read
 * @param repository the repository's directories
 * @returns the key for this tick
 */
export async function headKeyOf(
  deps: Types.HeadKeyDeps,
  repository: Types.Repository,
): Promise<string> {
  const own = stampProbeOf(
    deps,
    repository.gitDir,
    Limits.MAX_LISTED_DIRECTORIES,
  )

  const isShared = repository.commonDir === repository.gitDir

  const common = isShared
    ? own
    : stampProbeOf(deps, repository.commonDir, Limits.MAX_LISTED_DIRECTORIES)

  async function viaGit() {
    const parsed = await deps.run([
      Argv.NO_OPTIONAL_LOCKS,
      'rev-parse',
      '--verify',
      '--quiet',
      'HEAD',
    ])

    return `rev:${parsed.exitCode === 0 ? parsed.stdout.trim() : ''}`
  }

  const listed = await own.walk.entryOf('HEAD')

  if (listed === 'over-budget' || listed?.kind !== 'file') {
    return viaGit()
  }

  const head = await deps.readFile(`${repository.gitDir}/HEAD`).catch(() => '')
  const ref = head.startsWith('ref: ') ? head.slice('ref: '.length).trim() : ''
  const isSymbolic = ref !== ''

  const isUnsafeRef = isSymbolic && !isSafeRefName(ref)
  const logged = isUnsafeRef ? await listedStampOf(own, 'logs/HEAD') : null
  const isUndated = isUnsafeRef && typeof logged !== 'number'
  const isRefDated = isSymbolic && !isUnsafeRef

  return isUndated
    ? viaGit()
    : [
        head,
        await listedStampOf(own, 'HEAD'),
        isRefDated ? await listedStampOf(common, ref) : logged,
        await listedStampOf(common, 'packed-refs'),
      ].join('|')
}
