import type { ToolGroupCall } from 'claude-code'

/**
 * What a drawn row tells of its call, on every component that shows one.
 */
export type ToolCallRow = Pick<
  ToolGroupCall,
  'tool_use_id' | 'tool' | 'input' | 'output' | 'isErrored'
>
