import type { GitDeps } from '../git-deps'

/**
 * What reading the HEAD key takes: git for the fallback, listings and
 * timestamps for the files, and a file read for HEAD's text.
 */
export type HeadKeyDeps = Pick<GitDeps, 'run' | 'mtimeOf' | 'entriesOf'> & {
  /**
   * A file's text; rejects when it cannot be read.
   */
  readFile: (path: string) => Promise<string>
}
