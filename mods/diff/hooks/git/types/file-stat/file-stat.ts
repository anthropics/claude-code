/**
 * One changed file's row: its repository-relative path, its line counts,
 * and what kind of change it is.
 *
 * `isPreSession` is set in session mode alone, when the file's timestamp
 * predates the session's start (an untracked file too); `renamedFrom` is
 * the old path of a rename git detected, else null.
 */
export type FileStat = {
  path: string
  renamedFrom: string | null
  added: number
  removed: number
  isBinary: boolean
  isUntracked: boolean
  isPreSession: boolean
}
