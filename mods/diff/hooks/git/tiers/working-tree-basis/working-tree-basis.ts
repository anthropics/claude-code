import type DiffDataOf from '../diff-data-of'

/**
 * The basis of a plain working-tree diff: against HEAD, commits present,
 * every body current.
 */
export const WORKING_TREE_BASIS: DiffDataOf.DiffBasis = Object.freeze({
  source: Object.freeze({ kind: 'working-tree', base: 'HEAD' }),
  baseRef: 'HEAD',
  isUnborn: false,
  stalePaths: Object.freeze([]),
})
