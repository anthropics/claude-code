import type { Segment } from './segment'

/**
 * The docked pane's scrolling body laid out: its segments and their rows,
 * the window, each file's first row, the list block's rows (end exclusive).
 */
export type BodyLayout = {
  segments: readonly Segment[]
  extent: number
  visibleRows: number
  maxTop: number
  tops: ReadonlyMap<string, number>
  listTop: number
  listEnd: number
}
