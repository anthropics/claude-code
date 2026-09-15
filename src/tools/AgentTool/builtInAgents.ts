import { feature } from 'bun:bundle'
import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { CLAUDE_CODE_GUIDE_AGENT } from './built-in/claudeCodeGuideAgent.js'
import { EXPLORE_AGENT } from './built-in/exploreAgent.js'
import { GENERAL_PURPOSE_AGENT } from './built-in/generalPurposeAgent.js'
import { PLAN_AGENT } from './built-in/planAgent.js'
import { STATUSLINE_SETUP_AGENT } from './built-in/statuslineSetup.js'
import { VERIFICATION_AGENT } from './built-in/verificationAgent.js'
import type { AgentDefinition } from './loadAgentsDir.js'

export function areExplorePlanAgentsEnabled(): boolean {
  if (feature('BUILTIN_EXPLORE_PLAN_AGENTS')) {
    // 3P default: true — Bedrock/Vertex keep agents enabled (matches pre-experiment
    // external behavior). A/B test treatment sets false to measure impact of removal.
    return getFeatureValue_CACHED_MAY_BE_STALE('tengu_amber_stoat', true)
  }
  return false
}

export function getBuiltInAgents(): AgentDefinition[] {
  // Allow disabling all built-in agents via env var (useful for SDK users who want a blank slate)
  // Only applies in noninteractive mode (SDK/API usage)
  if (
    isEnvTruthy(process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS) &&
    getIsNonInteractiveSession()
  ) {
    return []
  }

  // Use lazy require inside the function body to avoid circular dependency
  // issues at module init time. The coordinatorMode module depends on tools
  // which depend on AgentTool which imports this file.
  if (feature('COORDINATOR_MODE')) {
    if (isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE)) {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { getCoordinatorAgents } =
        require('../../coordinator/workerAgent.js') as typeof import('../../coordinator/workerAgent.js')
      /* eslint-enable @typescript-eslint/no-require-imports */
      return getCoordinatorAgents()
    }
  }

  const agents: AgentDefinition[] = [
    GENERAL_PURPOSE_AGENT,
    STATUSLINE_SETUP_AGENT,
  ]

  if (areExplorePlanAgentsEnabled()) {
    agents.push(EXPLORE_AGENT, PLAN_AGENT)
  }

  // Include Code Guide agent for non-SDK entrypoints
  const isNonSdkEntrypoint =
    process.env.CLAUDE_CODE_ENTRYPOINT !== 'sdk-ts' &&
    process.env.CLAUDE_CODE_ENTRYPOINT !== 'sdk-py' &&
    process.env.CLAUDE_CODE_ENTRYPOINT !== 'sdk-cli'

  if (isNonSdkEntrypoint) {
    agents.push(CLAUDE_CODE_GUIDE_AGENT)
  }

  if (
    feature('VERIFICATION_AGENT') &&
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_hive_evidence', false)
  ) {
    agents.push(VERIFICATION_AGENT)
  }

  return agents
}
