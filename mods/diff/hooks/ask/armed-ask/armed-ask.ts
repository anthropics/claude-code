/**
 * The file the person asked about from the pane: its path and its diff as
 * text, held until the next prompt carries it as context.
 */
export type ArmedAsk = {
  path: string
  text: string
  lines: number
}
