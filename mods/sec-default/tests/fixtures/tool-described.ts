import type { Origin, ToolDescribeInput } from 'claude-code'

/**
 * A tool's description as the engine asks for it, `d`, pinned to who
 * provides the tool.
 *
 * @param tool the tool's name
 * @param provider who provides it, as the engine pinned it
 * @returns the `tool.describe` input
 */
export const toolDescribed = (
  tool: string,
  provider: Origin,
): ToolDescribeInput => ({ tool, description: 'd', provider })
