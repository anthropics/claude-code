import Frames from '../frames'

/**
 * The project directory an instruction file speaks for: the directory
 * holding it, or the one holding its `.claude` folder.
 *
 * @param path the file's path, absolute
 * @returns the directory, in the walk's normal spelling
 */
export function projectDirOf(path: string): string {
  const spelled = Frames.normalSpellingOf(path)
  const claudeAt = spelled.lastIndexOf('/.claude/')
  const cut = claudeAt === -1 ? spelled.lastIndexOf('/') : claudeAt

  return cut <= 0 ? '/' : spelled.slice(0, cut)
}
