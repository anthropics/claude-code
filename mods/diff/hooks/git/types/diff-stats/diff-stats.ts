/**
 * A diff's totals as `--numstat` or `--shortstat` count them.
 */
export type DiffStats = {
  filesCount: number
  linesAdded: number
  linesRemoved: number
}
