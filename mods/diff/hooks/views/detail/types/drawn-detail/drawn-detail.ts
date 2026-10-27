import type { RenderElement } from 'claude-code'

import type { BodyRoom } from '../body-room'

/**
 * One file's detail as drawn, and the room left for the files after it.
 */
export type DrawnDetail = {
  element: RenderElement
  room: BodyRoom
}
