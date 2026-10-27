import type Git from '../../../git'

/**
 * One file as the pane lists and draws it: its row's counts and name, its
 * kind, and its hunks so far (undefined loading, null unreadable).
 */
export type BodyEntry = {
  path: string
  displayPath: string
  added: number
  removed: number
  isUntracked: boolean
  isBinary: boolean
  body: Git.FileHunks | null | undefined
}
