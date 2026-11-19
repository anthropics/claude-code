import { getFeatureValue_CACHED_MAY_BE_STALE } from 'src/services/analytics/growthbook.js'
import type { EffortLevel } from '../effort.js'

export type AntModel = {
  alias: string
  model: string
  label: string
  description?: string
  defaultEffortValue?: number
  defaultEffortLevel?: EffortLevel
  contextWindow?: number
  defaultMaxTokens?: number
  upperMaxTokensLimit?: number
  /** Model defaults to adaptive thinking and rejects `thinking: { type: 'disabled' }`. */
  alwaysOnThinking?: boolean
}

export type AntModelSwitchCalloutConfig = {
  modelAlias?: string
  description: string
  version: string
}

export type AntModelOverrideConfig = {
  defaultModel?: string
  defaultModelEffortLevel?: EffortLevel
  defaultSystemPromptSuffix?: string
  antModels?: AntModel[]
  switchCallout?: AntModelSwitchCalloutConfig
}

// @[MODEL LAUNCH]: Update tengu_ant_model_override with new ant-only models
// @[MODEL LAUNCH]: Add the codename to scripts/excluded-strings.txt to prevent it from leaking to external builds.
export function getAntModelOverrideConfig(): AntModelOverrideConfig | null {
  if (process.env.USER_TYPE !== 'ant') {
    return null
  }
  return getFeatureValue_CACHED_MAY_BE_STALE<AntModelOverrideConfig | null>(
    'tengu_ant_model_override',
    null,
  )
}

export function getAntModels(): AntModel[] {
  if (process.env.USER_TYPE !== 'ant') {
    return []
  }
  return getAntModelOverrideConfig()?.antModels ?? []
}

export function resolveAntModel(
  model: string | undefined,
): AntModel | undefined {
  if (process.env.USER_TYPE !== 'ant') {
    return undefined
  }
  if (model === undefined) {
    return undefined
  }
  const lower = model.toLowerCase()
  return getAntModels().find(
    m => m.alias === model || lower.includes(m.model.toLowerCase()),
  )
}
