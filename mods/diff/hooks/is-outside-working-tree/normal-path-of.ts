/**
 * An absolute path spelled one way, its names joined by `/` with no
 * leading or trailing one: either separator splits, `.` and empty names
 * drop, `..` drops the name before it. No disk is read, no link followed.
 *
 * A drive-letter path is lowercased, as its file system compares names.
 *
 * @param path an absolute path, POSIX or drive-letter
 * @returns the names joined, empty for the root
 */
export function normalPathOf(path: string): string {
  const names: string[] = []

  for (const name of path.split(/[\\/]/)) {
    if (name === '..') {
      names.pop()
    } else if (name !== '' && name !== '.') {
      names.push(name)
    }
  }

  const spelled = names.join('/')

  return /^[A-Za-z]:/.test(spelled) ? spelled.toLowerCase() : spelled
}
