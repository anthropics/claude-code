import type { Host } from '../host'
import type { NamedFile } from './named-file.js'
import type { ReadVerdict } from './read-verdict.js'
import { readVerdictsOf } from './read-verdicts-of.js'
import { spellingsOf } from './spellings-of.js'

const HIDING = ['denied', 'unknown', 'untold'] as const

/**
 * The files the pane leaves out: one a Read rule denies by any of its paths,
 * and one the engine did not answer for.
 *
 * @param engine the bound host
 * @param files the files about to be drawn
 * @param roots where their names lie; null when that could not be read
 * @returns those of `files` to leave out, each with why
 */
export async function hiddenOf(
  engine: Pick<Host, 'after' | 'checkRead'>,
  files: readonly NamedFile[],
  roots: readonly string[] | null,
): Promise<ReadonlyMap<NamedFile, ReadVerdict>> {
  if (roots === null) {
    return new Map(files.map(file => [file, 'unknown']))
  }

  const verdictOf = await readVerdictsOf(
    engine,
    files.flatMap(file => spellingsOf(file, roots)),
  )

  return new Map(
    files.flatMap(file => {
      const verdicts = spellingsOf(file, roots).map(verdictOf)

      const why = HIDING.find(one => verdicts.includes(one))

      return why ? [[file, why] as const] : []
    }),
  )
}
