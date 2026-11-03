/**
 * What the plugin knows of its pane when `/diff` runs.
 *
 * Whether the pane is open (it opened it, and no close of any origin has
 * gone through since), and the terminal's width as last drawn (null before
 * any draw).
 */
export type PaneBelief = {
  isOpen: boolean
  columns: number | null
}
