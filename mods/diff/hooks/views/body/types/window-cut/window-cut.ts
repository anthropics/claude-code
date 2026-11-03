/**
 * How the body's window cuts one hunk: the wrapped rows its top hides, and
 * the rows it still has room for from there.
 */
export type WindowCut = {
  skip: number
  take: number
}
