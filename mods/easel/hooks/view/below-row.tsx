/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { Elements, RenderElement, RenderSurface } from 'claude-code'

import type Types from './types'

/**
 * Stands a drawing beneath the row that the host drew for the same call.
 *
 * @param elements the elements of the surface that draws both
 * @param drawing what the host drew for the call, if anything
 * @param chart the drawing to stand below
 * @returns the two in one column, the host's row first
 */
export const belowRow = (
  elements: Elements[RenderSurface],
  drawing: Types.DrawnByHost,
  chart: RenderElement,
): RenderElement => (
  <elements.Box flexDirection="column">
    {drawing.hostRow}
    {chart}
  </elements.Box>
)
