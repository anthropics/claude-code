import { INPUT_SCHEMA } from '../input-schema'
import { DESCRIPTION } from './description'

/**
 * The host puts `mcp__easel__` before the name.
 */
export const TOOL_SPEC = {
  name: 'chart',
  description: DESCRIPTION,
  inputSchema: INPUT_SCHEMA,
}
