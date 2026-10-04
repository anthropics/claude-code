/**
 * Whether `$.ui.render` answered the tree a hook drew, not the engine's own.
 *
 * A tree the engine refused (an element it lacks, a text or node budget
 * outrun) comes back as the engine's own drawing instead, an `engine` node.
 *
 * @param tree what `$.ui.render` resolved to
 * @returns true for a hook's tree, false for the engine's own
 */
export const isDrawn = (tree: unknown): boolean =>
  typeof tree === 'object' &&
  tree !== null &&
  Reflect.get(tree, 'type') !== 'engine'
