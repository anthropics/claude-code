/**
 * What is left of the pane's budget for file bodies: characters of `Code`
 * source and tree nodes, both counted as the host counts a tree.
 */
export type BodyRoom = {
  chars: number
  nodes: number
}
