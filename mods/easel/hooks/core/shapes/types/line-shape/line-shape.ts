import type { Ink } from '../ink'
import type { Point } from '../point'

/**
 * A stroke that runs through its points in the order they are listed.
 */
export type LineShape = { kind: 'line'; points: Point[]; ink: Ink }
