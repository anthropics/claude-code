import type { RenderSurface } from 'claude-code'

/**
 * Whether a render event comes from a surface that draws the pane: every
 * one but the mobile app, which has no Select and is not terminal-wide.
 *
 * @param e the render event, or anything naming its surface
 * @returns false on `mobile`, true otherwise, narrowing `e` to the rest
 */
export const isOnPaneSurface = <E extends Record<'surface', RenderSurface>>(
  e: E,
): e is Exclude<E, Record<'surface', 'mobile'>> => e.surface !== 'mobile'
