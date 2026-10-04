import type { RenderElement } from 'claude-code'

import { keptOf } from '../../../kept-of'

/**
 * The children that are there: nulls dropped, so a part may answer null for
 * "nothing to draw" and the parent lists it all the same.
 *
 * @param children elements or nulls
 * @returns the elements
 */
export const present = (
  children: readonly (RenderElement | null)[],
): RenderElement[] => keptOf(children)
