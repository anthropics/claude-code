/**
 * Where the session's repository lives: its working tree's top, its own git
 * directory (a linked worktree's), and the common directory holding refs.
 */
export type Repository = {
  toplevel: string
  gitDir: string
  commonDir: string
}
