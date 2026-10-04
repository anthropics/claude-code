/**
 * Where the surface put the pane for one drawing (`props.placement`), and
 * how wide the terminal is (`viewport.columns`; null before it measured).
 *
 * Inline on a terminal the dock would fit (OPEN_MIN_COLUMNS) means the
 * session draws no fullscreen layout, where the built-in shows its dialog.
 */
export type PaneSeat = {
  placement: 'dock' | 'inline'
  terminalColumns: number | null
}
