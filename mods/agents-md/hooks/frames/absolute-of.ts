/**
 * A path the model handed a Read, made absolute as the Read tool reads it.
 *
 * As given when it is absolute; under the home directory (less any trailing
 * separator) for `~` or a `~/` spelling when a home is known; else under the
 * working directory.
 *
 * @param path the Read's `file_path` as the model spelled it
 * @param root the session's working directory, absolute
 * @param home the home directory, absolute, when the environment names one
 * @returns the absolute path
 */
export function absoluteOf(path: string, root: string, home?: string): string {
  const isHomeSpelling = path === '~' || path.startsWith('~/')

  if (isHomeSpelling && home !== undefined) {
    const bare = home.replace(/(?<=.)[\\/]+$/, '')

    return path === '~' ? bare : `${bare}${separatorOf(bare)}${path.slice(2)}`
  }

  return /^(?:[A-Za-z]:)?[\\/]/.test(path)
    ? path
    : `${root}${separatorOf(root)}${path}`
}

/**
 * The separator a directory's own spelling uses.
 *
 * @param dir an absolute directory
 * @returns `\` for a backslash spelling, `/` otherwise
 */
const separatorOf = (dir: string): string => (dir.includes('\\') ? '\\' : '/')
