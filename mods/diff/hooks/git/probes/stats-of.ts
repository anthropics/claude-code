import Limits from '../../limits'
import Argv from '../argv'
import Parse from '../parse'
import type Types from '../types'

/**
 * The rows and totals of `git diff <base>`, or null when git could not
 * say (as the built-in panel's stats fetch) or its listing arrived cut.
 *
 * A `--shortstat` probe runs first, so a diff past MAX_FILES_FOR_DETAILS
 * answers its totals with no rows and no `--numstat` buffering.
 *
 * @param context runs git
 * @param base the ref (or `--cached`) the working tree is compared with
 * @returns the parsed result, or null on a failed numstat
 */
export async function statsOf(
  context: Types.FetchContext,
  base: string,
): Promise<Types.NumstatResult | null> {
  const run = context.run

  const shortstat = await run([...Argv.DIFF_LEADING_ARGS, base, '--shortstat'])

  const totals =
    shortstat.exitCode === 0 ? Parse.parseShortstat(shortstat.stdout) : null

  const isPastDetails =
    totals !== null && totals.filesCount > Limits.MAX_FILES_FOR_DETAILS

  if (isPastDetails) {
    return { stats: totals, files: [] }
  }

  const numstat = await run([
    ...Argv.DIFF_LEADING_ARGS,
    base,
    '--numstat',
    '-z',
  ])

  const isRead = Parse.isWholeAnswer(numstat)

  return isRead ? Parse.parseNumstat(numstat.stdout, Limits.MAX_FILES) : null
}
