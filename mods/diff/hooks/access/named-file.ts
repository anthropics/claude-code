/**
 * A file as the pane names it: a row's path under the working tree's top,
 * with a rename's old one, or a turn's path as its tool call gave it.
 */
export type NamedFile = {
  path: string
  renamedFrom: string | null
  isTurnFile: boolean
}
