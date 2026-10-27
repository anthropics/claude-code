import Tree from '../tree'

/**
 * A pane row as the layout tests read it: `blank` for a bare one-row Box,
 * `rule` for a line of rule characters, else its first label or its strings.
 *
 * @param node a row of the pane's body
 * @returns the row's shape
 */
export function rowShapeOf(node: unknown) {
  const text = Tree.jsonOf(node)
  const strings = Tree.stringsOf(node).join('')
  const label = /"label":"([^"]*)"/.exec(text)?.[1]
  const isBlank = text === '{"type":"Box","props":{"height":1}}'
  const isRule = /^─+$/.test(strings)

  return isBlank ? 'blank' : isRule ? 'rule' : (label ?? strings)
}
