import type { RenderInput } from 'claude-code'

import { QUERY_TOOL } from './query-tool.js'

/**
 * The row of a finished query on a terminal.
 *
 * @param output what the tool answered
 * @returns what the host asks to have drawn
 */
export function queryRow(output: unknown): RenderInput<'ToolUse'> {
  return {
    component: 'ToolUse',
    surface: 'terminal',
    requestId: 'query-1',
    viewport: { columns: 100, rows: 40 },
    props: {
      tool_use_id: 'query-1',
      tool: QUERY_TOOL,
      input: {},
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
      output,
    },
  }
}
