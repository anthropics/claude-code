/**
 * In a scene: cells from the left edge, rows from the top, so `y` grows down.
 * In a `Plot`: positions from 0 to 1, and `y` grows upwards.
 *
 * Fractions are allowed, and a painter rounds them to what its surface shows.
 */
export type Point = { x: number; y: number }
