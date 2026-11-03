import Limits from '../../limits'
import Argv from '../argv'
import Parse from '../parse'
import type Types from '../types'

/**
 * The rows and totals of `git diff <base>`, or only the totals past
 * MAX_FILES_FOR_DETAILS. Null when git failed, or when the listing was cut at
 * the host's output cap and `--shortstat` counted MAX_FILES_FOR_DETAILS files
 * or fewer.
 *
 * @param context runs git, and keeps the bases whose listing was cut
 * @param base the ref (or `--cached`) the working tree is compared with
 * @returns the parsed result, or null
 */
export async function statsOf(
  context: Types.FetchContext,
  base: string,
): Promise<Types.NumstatResult | null> {
  const run = context.run
  const cutBases = context.deps.cutBases
  const shortstatArgv = [...Argv.DIFF_LEADING_ARGS, base, '--shortstat']

  if (cutBases?.has(base)) {
    const shortstat = await run(shortstatArgv)

    if (shortstat.exitCode !== 0) {
      return null
    }

    const totals = Parse.parseShortstat(shortstat.stdout)

    if (totals !== null && totals.filesCount > Limits.MAX_FILES_FOR_DETAILS) {
      return { stats: totals, files: [] }
    }
  }

  const numstat = await run([
    ...Argv.DIFF_LEADING_ARGS,
    base,
    '--numstat',
    '-z',
  ])

  if (Parse.isWholeAnswer(numstat)) {
    cutBases?.delete(base)

    const read = Parse.parseNumstat(numstat.stdout, Limits.MAX_FILES)
    const isPastDetails = read.stats.filesCount > Limits.MAX_FILES_FOR_DETAILS

    return isPastDetails ? { stats: read.stats, files: [] } : read
  }

  if (numstat.exitCode !== 0) {
    return null
  }

  cutBases?.add(base)

  const shortstat = await run(shortstatArgv)

  const totals =
    shortstat.exitCode === 0 ? Parse.parseShortstat(shortstat.stdout) : null

  const isPastDetails =
    totals !== null && totals.filesCount > Limits.MAX_FILES_FOR_DETAILS

  return isPastDetails ? { stats: totals, files: [] } : null
}
