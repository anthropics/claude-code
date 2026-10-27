/**
 * The header's counts: the fetched totals less the pre-session rows, and
 * how many session files fell past the row cap ("not shown").
 */
export type HeaderTotals = {
  filesCount: number
  linesAdded: number
  linesRemoved: number
  notShown: number
}
