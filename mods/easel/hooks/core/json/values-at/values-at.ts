import { childrenAt } from './children-at'

/**
 * What a trail of steps, parted by dots, leads to in parsed JSON.
 *
 * A step is a key or an index. `[]` stands for every item of an array and
 * `*` for every value of an object: `data.result.[].metric`.
 *
 * @param node where the trail starts
 * @param path the steps
 * @returns all that the trail leads to, nothing where a step leads nowhere
 */
export function valuesAt(node: unknown, path = ''): unknown[] {
  let nodes = [node]

  for (const step of path.split('.').filter(part => part !== '')) {
    nodes = nodes.flatMap(parent => childrenAt(parent, step))
  }

  return nodes
}
