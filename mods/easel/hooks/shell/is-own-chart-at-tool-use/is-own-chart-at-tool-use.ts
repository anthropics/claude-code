import type Types from '../types'

/**
 * A terminal draws the tool's own chart at ToolResult, an app at ToolUse.
 *
 * @param surface where the row is drawn
 * @returns whether the chart of the tool's own call is drawn with its use
 */
export const isOwnChartAtToolUse = (surface: Types.RowSurface): boolean =>
  surface !== 'terminal'
