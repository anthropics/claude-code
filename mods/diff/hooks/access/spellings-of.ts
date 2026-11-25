import type { NamedFile } from './named-file.js'

const ABSOLUTE = /^(?:[\\/]|[A-Za-z]:[\\/])/

/**
 * Every path a file goes by: each of its names under each root. A turn's
 * path also stands as given, and alone when it is absolute.
 *
 * @param file the file
 * @param roots the working tree's top, and the current folder's (liveRootOf)
 * @returns the paths
 */
export function spellingsOf(
  file: NamedFile,
  roots: readonly string[],
): string[] {
  const { path, renamedFrom, isTurnFile } = file

  if (isTurnFile && ABSOLUTE.test(path)) {
    return [path]
  }

  const names = renamedFrom === null ? [path] : [path, renamedFrom]

  return [
    ...(isTurnFile ? [path] : []),
    ...roots.flatMap(root =>
      names.map(name => `${root.replace(/[\\/]$/, '')}/${name}`),
    ),
  ]
}
