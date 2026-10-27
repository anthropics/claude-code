import Tree from '../tree'
import { rowShapeOf } from './row-shape-of.js'

/**
 * The rows of a pane's body, top to bottom, each as the layout tests read
 * it (rowShapeOf).
 *
 * @param tree the pane's tree, its body the first child
 * @returns each row's shape
 */
export const rowShapesOf = (tree: unknown) =>
  Tree.childrenOf(Tree.childrenOf(tree)[0]).map(rowShapeOf)
