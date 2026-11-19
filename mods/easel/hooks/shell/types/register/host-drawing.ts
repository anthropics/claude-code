import type { RenderElement, RenderInput } from 'claude-code'

import type { ChartCache } from '../chart-cache'
import type { ToolCallRow } from '../tool-call-row'

/**
 * What a render hook hands over to have the newest chart put below it.
 */
export type HostDrawing<HostRow extends RenderElement | null> = {
  /**
   * Where the charts of the session are kept.
   */
  cache: ChartCache

  /**
   * What the host asks to have drawn, and where.
   */
  event: RenderInput<'ToolUse' | 'ToolResult' | 'ToolGroup'>

  /**
   * What the host drew for the calls, or null where it drew nothing.
   */
  hostRow: HostRow

  /**
   * The calls that the host draws there, oldest first.
   */
  rows: readonly ToolCallRow[]

  /**
   * Whether a call of the tool of that name may hold a chart there.
   */
  isCharted: (tool: string) => boolean
}
