import { roughTokenCountEstimation } from '../services/tokenEstimation.js'
import type { AgentDefinitionsResult } from '../tools/AgentTool/loadAgentsDir.js'

export const AGENT_DESCRIPTIONS_THRESHOLD = 15_000

/**
 * Calculate cumulative token estimate for agent descriptions
 */
export function getAgentDescriptionsTotalTokens(
  agentDefinitions?: AgentDefinitionsResult,
): number {
  if (!agentDefinitions) return 0

  return agentDefinitions.activeAgents
    .filter(a => a.source !== 'built-in')
    .reduce((total, agent) => {
      const description = `${agent.agentType}: ${agent.whenToUse}`
      return total + roughTokenCountEstimation(description)
    }, 0)
}
