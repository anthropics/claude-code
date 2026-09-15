import type { Tools } from '../../Tool.js'
import { resolveAgentTools } from '../../tools/AgentTool/agentToolUtils.js'
import type {
  AgentDefinition,
  CustomAgentDefinition,
} from '../../tools/AgentTool/loadAgentsDir.js'
import { getAgentSourceDisplayName } from './utils.js'

export type AgentValidationResult = {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function validateAgentType(agentType: string): string | null {
  if (!agentType) {
    return 'Agent type is required'
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(agentType)) {
    return 'Agent type must start and end with alphanumeric characters and contain only letters, numbers, and hyphens'
  }

  if (agentType.length < 3) {
    return 'Agent type must be at least 3 characters long'
  }

  if (agentType.length > 50) {
    return 'Agent type must be less than 50 characters'
  }

  return null
}

export function validateAgent(
  agent: Omit<CustomAgentDefinition, 'location'>,
  availableTools: Tools,
  existingAgents: AgentDefinition[],
): AgentValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate agent type
  if (!agent.agentType) {
    errors.push('Agent type is required')
  } else {
    const typeError = validateAgentType(agent.agentType)
    if (typeError) {
      errors.push(typeError)
    }

    // Check for duplicates (excluding self for editing)
    const duplicate = existingAgents.find(
      a => a.agentType === agent.agentType && a.source !== agent.source,
    )
    if (duplicate) {
      errors.push(
        `Agent type "${agent.agentType}" already exists in ${getAgentSourceDisplayName(duplicate.source)}`,
      )
    }
  }

  // Validate description
  if (!agent.whenToUse) {
    errors.push('Description (description) is required')
  } else if (agent.whenToUse.length < 10) {
    warnings.push(
      'Description should be more descriptive (at least 10 characters)',
    )
  } else if (agent.whenToUse.length > 5000) {
    warnings.push('Description is very long (over 5000 characters)')
  }

  // Validate tools
  if (agent.tools !== undefined && !Array.isArray(agent.tools)) {
    errors.push('Tools must be an array')
  } else {
    if (agent.tools === undefined) {
      warnings.push('Agent has access to all tools')
    } else if (agent.tools.length === 0) {
      warnings.push(
        'No tools selected - agent will have very limited capabilities',
      )
    }

    // Check for invalid tools
    const resolvedTools = resolveAgentTools(agent, availableTools, false)

    if (resolvedTools.invalidTools.length > 0) {
      errors.push(`Invalid tools: ${resolvedTools.invalidTools.join(', ')}`)
    }
  }

  // Validate system prompt
  const systemPrompt = agent.getSystemPrompt()
  if (!systemPrompt) {
    errors.push('System prompt is required')
  } else if (systemPrompt.length < 20) {
    errors.push('System prompt is too short (minimum 20 characters)')
  } else if (systemPrompt.length > 10000) {
    warnings.push('System prompt is very long (over 10,000 characters)')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}
