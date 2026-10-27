import type { AgentSpawnInput, Origin } from 'claude-code'

/**
 * A subagent's spawn as the engine raises it, pinned to who provides the
 * agent's definition.
 *
 * @param provider who provides the agent, as the engine pinned it
 * @returns the `agent.spawn` input
 */
export const agentSpawned = (provider: Origin): AgentSpawnInput => ({
  tool_use_id: 't1',
  prompt: 'list the files in src',
  description: 'List files',
  subagentType: 'general-purpose',
  provider,
  parentModel: 'the-model',
  permissionMode: 'default',
  background: false,
  fork: false,
})
