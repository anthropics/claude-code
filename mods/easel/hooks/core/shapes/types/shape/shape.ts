import type { AxisRowShape } from '../axis-row-shape'
import type { BandShape } from '../band-shape'
import type { BarShape } from '../bar-shape'
import type { LineShape } from '../line-shape'
import type { StackShape } from '../stack-shape'
import type { StripShape } from '../strip-shape'
import type { TextShape } from '../text-shape'

/**
 * Everything a painter is asked to paint, told apart by its `kind`.
 */
export type Shape =
  | TextShape
  | BarShape
  | StackShape
  | LineShape
  | AxisRowShape
  | StripShape
  | BandShape
