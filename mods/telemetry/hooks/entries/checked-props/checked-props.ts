import { checkedValue } from '../checked-value'
import { isRecord } from '../is-record'
import type { Method } from '../method'
import { PROP_LIMIT } from '../prop-limit'
import { refusal } from '../refusal'
import { fits, TOKEN } from '../token'

/**
 * The shape of a mixed-case key that takes a Choice: plain camelCase, ending
 * at most in an abbreviation the CLI's own keys end in.
 */
const CAMEL = /^[a-z][a-z\d]*(?:[A-Z][a-z\d]+)*(?:ID|UUID|PTL)?$/

/**
 * The keys whose text is read off a row by these spellings alone, so a Choice
 * goes under no other mixed-case spelling of them.
 */
const SPELLINGS = `
  action addedTools advisor agent agentType agent_type alias args
  attributionAgent attributionMcpServer attributionMcpTool attributionPlugin
  attributionSkill baseUrl chain_entry changedToolSchemas checkedModel cli_flag
  command commandName command_name command_type comment currentModel cwd
  decisionReason default_env_var description descriptions detail dev_plugins
  disabled_names enabled_names envModel envSmallFastModel env_var error
  errorDetails error_name error_path errorPrefix error_top_frame exitCause
  fallbackFrom fallback_model feature_name file final_stop_reason flagged
  from_model gitBranch githubActionInputs goal hookEvent hook_event hookName
  host hostname input intent issuePath key language mainLoopModel
  marketplace_name mcpErrorSource mcpServerBaseUrl mcpServerName mcpToolName
  memory_type message messageClientPlatform messageTypes mimeType model model_id
  name namespace needs original_model overage_disabled_reason parent_agent_id
  parts permissions ph phase_title plugin pluginName plugin_name
  plugin_repository plugins preNormalizedModel query querySource query_source
  raw_value reason removedTools repository response responseBody result
  sampleToolName server server_message settings_file shortName skillName
  skill_name slug snippet source source_type stderr_errno stopReason style
  subagent_name subscriptionType subscription_type suggestion team_name term
  theme to_model tool toolName tool_name toolPermissionContext
  toolUseContentLengths unavailable_reason userInput value window_model
  workflow_description workflow_name
`.split(/\s+/)

const RUN_TOGETHER = SPELLINGS.map(key => key.replaceAll('_', '').toLowerCase())

/**
 * An entry's properties as they go into the row, or a refusal naming the
 * first thing wrong: the shape, the count, then each key and value in turn.
 *
 * `pluginId`, the stamp on an installed plugin's rows, is no caller's to send.
 *
 * @param props what the caller passed as `props`
 * @param method the method the properties were passed to, named in a refusal
 * @returns the properties by key, each value checked
 */
export function checkedProps(
  props: unknown,
  method: Method,
): Record<string, string | number | boolean> {
  if (!isRecord(props)) {
    throw refusal('props: an object of properties by key', method)
  }

  const entries = Object.entries(props)

  if (entries.length > PROP_LIMIT) {
    throw refusal(`props: at most ${PROP_LIMIT} properties`, method)
  }

  const checked: Record<string, string | number | boolean> = {}
  const seen = new Set<string>()

  for (const [key, value] of entries) {
    if (!fits(TOKEN, key)) {
      throw refusal('props: every key is snake_case or camelCase words', method)
    }

    const lowercase = key.toLowerCase()

    if (lowercase === 'pluginid') {
      throw refusal(`props.${key}: this key is reserved`, method)
    }

    if (seen.has(lowercase)) {
      throw refusal(`props.${key}: repeats a key in another case`, method)
    }

    const isRespelled =
      !CAMEL.test(key) ||
      (RUN_TOGETHER.includes(lowercase) && !SPELLINGS.includes(key))

    if (isRecord(value) && key !== lowercase && isRespelled) {
      throw refusal(`props.${key}: this spelling takes no Choice`, method)
    }

    seen.add(lowercase)
    checked[key] = checkedValue(key, value, method)
  }

  return checked
}
