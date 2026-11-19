import type { Shape } from './shape'

/**
 * The contract between the layout and the two painters: a list of shapes
 * placed in terminal cells.
 *
 * The shapes are in the order to paint them: a later one lies on top.
 */
export type Scene = { columns: number; rows: number; shapes: Shape[] }
