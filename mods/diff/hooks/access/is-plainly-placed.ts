import type { Host } from '../host'
import { messageOf } from '../message-of'

const TILDE_THEN_DIGIT = /~[0-9]/
const MISSING = / failed: (?:ENOENT|ENOTDIR)$/

const folded = (name: string) =>
  name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\p{Cf}/gu, '')

const foldersOf = (path: string) => path.match(/[^\\/]+(?=[\\/])/g) ?? []

const isUnderDownloads = (path: string) =>
  foldersOf(path).some(folder => folded(folder).includes('-downloads'))

function cutOf(path: string): { folder: string; name: string } {
  const slash = path.lastIndexOf('/')

  const at = path.startsWith('/')
    ? slash
    : Math.max(slash, path.lastIndexOf('\\'))

  return { folder: path.slice(0, at + 1), name: path.slice(at + 1) }
}

/**
 * Whether the pane can tell the path is one of the project's own files, by
 * its folders and what lies beside it. False wherever it cannot tell.
 *
 * A path with nothing at it is judged from the nearest folder that exists.
 *
 * @param engine the bound host's file probes
 * @param path the path
 * @returns whether it is; rejects when a folder cannot be listed
 */
export async function isPlainlyPlaced(
  engine: Pick<Host, 'resolve' | 'listDir'>,
  path: string,
): Promise<boolean> {
  if (path !== path.trim() || isUnderDownloads(path)) {
    return false
  }

  const rest: string[] = []

  let at = path
  let real: string | undefined

  while (real === undefined) {
    const stat = await engine
      .resolve(at)
      .catch((error: unknown) =>
        MISSING.test(messageOf(error)) ? null : { realPath: undefined },
      )

    if (stat) {
      if (stat.realPath === undefined) {
        return false
      }

      real = stat.realPath
    } else {
      const { folder, name } = cutOf(at.replace(/[\\/]$/, ''))

      if (name === '' || folder === '') {
        return false
      }

      rest.unshift(name)
      at = folder
    }
  }

  const landing = [
    rest.length > 0 ? real.replace(/[\\/]$/, '') : real,
    ...rest,
  ].join('/')

  const isUntold =
    path.startsWith('/') !== landing.startsWith('/') ||
    isUnderDownloads(landing) ||
    foldersOf(landing).some(folder => TILDE_THEN_DIGIT.test(folder))

  if (isUntold) {
    return false
  }

  if (rest.length > 1) {
    return true
  }

  const { folder, name } = cutOf(landing)
  const lead = folded(`.${name}.`)

  return !(await engine.listDir(folder))
    .map(entry => folded(entry.name))
    .some(
      beside =>
        beside.startsWith(lead) && /.\.json$/s.test(beside.slice(lead.length)),
    )
}
