import Limits from '../../limits'
import Argv from '../argv'
import { EMPTY_FILE_HUNKS } from '../empty-file-hunks'
import Parse from '../parse'
import type Types from '../types'
import { isLastOfDiff } from './is-last-of-diff'
import { withClosingLine } from './with-closing-line'

/**
 * The rows' hunks against the base their counts were read against, from one
 * git child over their literal paths; each but the last, a closing empty row.
 *
 * A row with no body (untracked, binary, renamed, or staged then edited on
 * an unborn HEAD) is never named to git. Paths past MAX_PATHSPEC_CHARS and
 * files a cut answer left unread go to a further child.
 *
 * @param run runs git against the pinned repository
 * @param data the fetch the rows belong to
 * @param files the rows
 * @returns each row's parsed body by path, null where git failed
 */
export async function fetchHunks(
  run: Types.GitRun,
  data: Types.DiffData,
  files: readonly Types.FileStat[],
): Promise<ReadonlyMap<string, Types.FileHunks | null>> {
  const bodied = files.filter(
    file =>
      !file.isUntracked &&
      !file.isBinary &&
      file.renamedFrom === null &&
      !data.stalePaths.includes(file.path),
  )

  const bodiless = files
    .filter(file => !bodied.includes(file))
    .map(file => [file.path, EMPTY_FILE_HUNKS] as const)

  if (bodied.length === 0) {
    return new Map(bodiless)
  }

  let spent = 0

  const asked = bodied
    .map(file => file.path)
    .filter((path, at) => {
      spent += path.length

      return at === 0 || spent <= Limits.MAX_PATHSPEC_CHARS
    })

  const { exitCode, stdout } = await run([
    '--literal-pathspecs',
    ...Argv.DIFF_LEADING_ARGS,
    ...Argv.HUNKS_ARGS,
    data.baseRef,
    '--',
    ...asked,
  ])

  const hasAnswered = exitCode === 0

  const settled = hasAnswered
    ? Parse.parseFileDiffs(stdout, asked)
    : new Map<string, Types.FileHunks>()

  const waiting = bodied.filter(file => !settled.has(file.path))
  const isStuck = settled.size === 0

  const rest = isStuck
    ? waiting.map(file => [file.path, null] as const)
    : await fetchHunks(run, data, waiting)

  return new Map<string, Types.FileHunks | null>([
    ...bodiless,
    ...bodied.flatMap(file => {
      const body = settled.get(file.path)
      const isLast = isLastOfDiff(data, file)

      return body
        ? [[file.path, isLast ? body : withClosingLine(body)] as const]
        : []
    }),
    ...rest,
  ])
}
