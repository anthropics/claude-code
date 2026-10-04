import Argv from '../argv'
import Parse from '../parse'
import type Types from '../types'

/**
 * Plain `git diff --numstat` (index against working tree), the one diff
 * beside `--cached` that runs on an unborn HEAD; null on failure or a cut.
 *
 * Parsed uncapped, since its rows correct rows already kept.
 *
 * @param run runs git
 * @returns every row, or null when git failed
 */
export async function unstagedNumstat(
  run: Types.GitRun,
): Promise<Types.NumstatResult | null> {
  const numstat = await run([...Argv.DIFF_LEADING_ARGS, '--numstat', '-z'])
  const isRead = Parse.isWholeAnswer(numstat)

  return isRead
    ? Parse.parseNumstat(numstat.stdout, Number.POSITIVE_INFINITY)
    : null
}
