import type { Args } from 'claude-code'

import type { Call } from './call.js'

/**
 * The call `tool.call` or `tool.run` is about: its input, which the event
 * spreads beside its own keys, put together again.
 *
 * @param e the event's argument
 * @returns the tool and its input
 */
export function callOf(e: Args<'tool.call' | 'tool.run'>): Call {
  const {
    tool: _tool,
    tool_use_id: _id,
    agentId: _agentId,
    requestMeta: _requestMeta,
    $shadowed: shadowed,
    ...input
  }: Record<string, unknown> = { ...e }

  return { tool: e.tool, input: { ...input, ...Object(shadowed) } }
}
