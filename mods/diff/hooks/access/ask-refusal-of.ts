import type { Host } from '../host'
import { isPlainlyPlaced } from './is-plainly-placed.js'
import type { NamedFile } from './named-file.js'
import { readVerdictsOf } from './read-verdicts-of.js'
import { spellingsOf } from './spellings-of.js'
import { withinTime } from './within-time.js'

/**
 * Why a file's diff is not attached, or null when it may be: every path it
 * goes by is open to Read and plainly placed (isPlainlyPlaced).
 *
 * @param engine the bound host
 * @param file the file asked about
 * @param roots where its names lie; null when that could not be read
 * @returns `denied` under a Read rule, `unsure` for anything else, or null
 */
export async function askRefusalOf(
  engine: Pick<Host, 'after' | 'checkRead' | 'resolve' | 'listDir'>,
  file: NamedFile,
  roots: readonly string[] | null,
): Promise<'denied' | 'unsure' | null> {
  if (roots === null) {
    return 'unsure'
  }

  const paths = spellingsOf(file, roots)

  const [verdictOf, placed] = await Promise.all([
    readVerdictsOf(engine, paths),
    withinTime(
      engine,
      Promise.all(paths.map(path => isPlainlyPlaced(engine, path))),
      [false],
    ),
  ])

  const verdicts = paths.map(verdictOf)

  if (verdicts.includes('denied')) {
    return 'denied'
  }

  const isClear =
    verdicts.every(verdict => verdict === 'open') && !placed.includes(false)

  return isClear ? null : 'unsure'
}
