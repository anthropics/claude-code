import type { AgentOfferInput, Origin } from 'claude-code'

/**
 * An agent type's offer as the engine asks for it, pinned to who provides
 * the agent.
 *
 * @param agent the agent type
 * @param provider who provides it, as the engine pinned it
 * @returns the `agent.offer` input
 */
export const agentOffered = (
  agent: string,
  provider: Origin,
): AgentOfferInput => ({ agent, description: 'd', source: 'plugin', provider })
