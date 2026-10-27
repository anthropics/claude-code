import { MAX_BODY_CHARS } from '../max-body-chars'
import { MAX_BODY_NODES } from '../max-body-nodes'
import type Types from '../types'

/**
 * The room the pane's file bodies start from at each drawing, spent file by
 * file in drawing order.
 */
export const BODY_BUDGET: Types.BodyRoom = Object.freeze({
  chars: MAX_BODY_CHARS,
  nodes: MAX_BODY_NODES,
})
