import type { RenderInput } from 'claude-code'

/**
 * Where a row is drawn: a terminal or an app.
 */
export type RowSurface = RenderInput<
  'ToolUse' | 'ToolResult' | 'ToolGroup'
>['surface']
