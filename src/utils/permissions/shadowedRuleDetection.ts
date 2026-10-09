import type { ToolPermissionContext } from '../../Tool.js'
import { BASH_TOOL_NAME } from '../../tools/BashTool/toolName.js'
import type { PermissionRule, PermissionRuleSource } from './PermissionRule.js'
import {
  getAllowRules,
  getAskRules,
  getDenyRules,
  permissionRuleSourceDisplayString,
} from './permissions.js'

/**
 * Type of shadowing that makes a rule unreachable
 */
export type ShadowType = 'ask' | 'deny'

/**
 * Represents an unreachable permission rule with explanation
 */
export type UnreachableRule = {
  rule: PermissionRule
  reason: string
  shadowedBy: PermissionRule
  shadowType: ShadowType
  fix: string
}

/**
 * Options for detecting unreachable rules
 */
export type DetectUnreachableRulesOptions = {
  /**
   * Whether sandbox auto-allow is enabled for Bash commands.
   * When true, tool-wide Bash ask rules from personal settings don't block
   * specific Bash allow rules because sandboxed commands are auto-allowed.
   */
  sandboxAutoAllowEnabled: boolean
}

/**
 * Result of checking if a rule is shadowed.
 * Uses discriminated union for type safety.
 */
type ShadowResult =
  | { shadowed: false }
  | { shadowed: true; shadowedBy: PermissionRule; shadowType: ShadowType }

/**
 * Check if a permission rule source is shared (visible to other users).
 * Shared settings include:
 * - projectSettings: Committed to git, shared with team
 * - policySettings: Enterprise-managed, pushed to all users
 * - command: From slash command frontmatter, potentially shared
 *
 * Personal settings include:
 * - userSettings: User's global ~/.claude settings
 * - localSettings: Gitignored per-project settings
 * - cliArg: Runtime CLI arguments
 * - session: In-memory session rules
 * - flagSettings: From --settings flag (runtime)
 */
export function isSharedSettingSource(source: PermissionRuleSource): boolean {
  return (
    source === 'projectSettings' ||
    source === 'policySettings' ||
    source === 'command'
  )
}

/**
 * Format a rule source for display in warning messages.
 */
function formatSource(source: PermissionRuleSource): string {
  return permissionRuleSourceDisplayString(source)
}

/**
 * Generate a fix suggestion based on the shadow type.
 */
function generateFixSuggestion(
  shadowType: ShadowType,
  shadowingRule: PermissionRule,
  shadowedRule: PermissionRule,
): string {
  const shadowingSource = formatSource(shadowingRule.source)
  const shadowedSource = formatSource(shadowedRule.source)
  const toolName = shadowingRule.ruleValue.toolName

  if (shadowType === 'deny') {
    return `Remove the "${toolName}" deny rule from ${shadowingSource}, or remove the specific allow rule from ${shadowedSource}`
  }
  return `Remove the "${toolName}" ask rule from ${shadowingSource}, or remove the specific allow rule from ${shadowedSource}`
}

/**
 * Check if a specific allow rule is shadowed (unreachable) by an ask rule.
 *
 * An allow rule is unreachable when:
 * 1. There's a tool-wide ask rule (e.g., "Bash" in ask list)
 * 2. And a specific allow rule (e.g., "Bash(ls:*)" in allow list)
 *
 * The ask rule takes precedence, making the specific allow rule unreachable
 * because the user will always be prompted first.
 *
 * Exception: For Bash with sandbox auto-allow enabled, tool-wide ask rules
 * from PERSONAL settings don't shadow specific allow rules because:
 * - Sandboxed commands are auto-allowed regardless of ask rules
 * - This only applies to personal settings (userSettings, localSettings, etc.)
 * - Shared settings (projectSettings, policySettings) always warn because
 *   other team members may not have sandbox enabled
 */
function isAllowRuleShadowedByAskRule(
  allowRule: PermissionRule,
  askRules: PermissionRule[],
  options: DetectUnreachableRulesOptions,
): ShadowResult {
  const { toolName, ruleContent } = allowRule.ruleValue

  // Only check allow rules that have specific content (e.g., "Bash(ls:*)")
  // Tool-wide allow rules cannot be shadowed by ask rules
  if (ruleContent === undefined) {
    return { shadowed: false }
  }

  // Find any tool-wide ask rule for the same tool
  const shadowingAskRule = askRules.find(
    askRule =>
      askRule.ruleValue.toolName === toolName &&
      askRule.ruleValue.ruleContent === undefined,
  )

  if (!shadowingAskRule) {
    return { shadowed: false }
  }

  // Special case: Bash with sandbox auto-allow from personal settings
  // The sandbox exception is based on the ASK rule's source, not the allow rule's source.
  // If the ask rule is from personal settings, the user's own sandbox will auto-allow.
  // If the ask rule is from shared settings, other team members may not have sandbox enabled.
  if (toolName === BASH_TOOL_NAME && options.sandboxAutoAllowEnabled) {
    if (!isSharedSettingSource(shadowingAskRule.source)) {
      return { shadowed: false }
    }
    // Fall through to mark as shadowed - shared settings should always warn
  }

  return { shadowed: true, shadowedBy: shadowingAskRule, shadowType: 'ask' }
}

/**
 * Check if an allow rule is shadowed (completely blocked) by a deny rule.
 *
 * An allow rule is unreachable when:
 * 1. There's a tool-wide deny rule (e.g., "Bash" in deny list)
 * 2. And a specific allow rule (e.g., "Bash(ls:*)" in allow list)
 *
 * Deny rules are checked first in the permission evaluation order,
 * so the allow rule will never be reached - the tool is always denied.
 * This is more severe than ask-shadowing because the rule is truly blocked.
 */
function isAllowRuleShadowedByDenyRule(
  allowRule: PermissionRule,
  denyRules: PermissionRule[],
): ShadowResult {
  const { toolName, ruleContent } = allowRule.ruleValue

  // Only check allow rules that have specific content (e.g., "Bash(ls:*)")
  // Tool-wide allow rules conflict with tool-wide deny rules but are not "shadowed"
  if (ruleContent === undefined) {
    return { shadowed: false }
  }

  // Find any tool-wide deny rule for the same tool
  const shadowingDenyRule = denyRules.find(
    denyRule =>
      denyRule.ruleValue.toolName === toolName &&
      denyRule.ruleValue.ruleContent === undefined,
  )

  if (!shadowingDenyRule) {
    return { shadowed: false }
  }

  return { shadowed: true, shadowedBy: shadowingDenyRule, shadowType: 'deny' }
}

/**
 * Detect all unreachable permission rules in the given context.
 *
 * Currently detects:
 * - Allow rules shadowed by tool-wide deny rules (more severe - completely blocked)
 * - Allow rules shadowed by tool-wide ask rules (will always prompt)
 */
export function detectUnreachableRules(
  context: ToolPermissionContext,
  options: DetectUnreachableRulesOptions,
): UnreachableRule[] {
  const unreachable: UnreachableRule[] = []

  const allowRules = getAllowRules(context)
  const askRules = getAskRules(context)
  const denyRules = getDenyRules(context)

  // Check each allow rule for shadowing
  for (const allowRule of allowRules) {
    // Check deny shadowing first (more severe)
    const denyResult = isAllowRuleShadowedByDenyRule(allowRule, denyRules)
    if (denyResult.shadowed) {
      const shadowSource = formatSource(denyResult.shadowedBy.source)
      unreachable.push({
        rule: allowRule,
        reason: `Blocked by "${denyResult.shadowedBy.ruleValue.toolName}" deny rule (from ${shadowSource})`,
        shadowedBy: denyResult.shadowedBy,
        shadowType: 'deny',
        fix: generateFixSuggestion('deny', denyResult.shadowedBy, allowRule),
      })
      continue // Don't also report ask-shadowing if deny-shadowed
    }

    // Check ask shadowing
    const askResult = isAllowRuleShadowedByAskRule(allowRule, askRules, options)
    if (askResult.shadowed) {
      const shadowSource = formatSource(askResult.shadowedBy.source)
      unreachable.push({
        rule: allowRule,
        reason: `Shadowed by "${askResult.shadowedBy.ruleValue.toolName}" ask rule (from ${shadowSource})`,
        shadowedBy: askResult.shadowedBy,
        shadowType: 'ask',
        fix: generateFixSuggestion('ask', askResult.shadowedBy, allowRule),
      })
    }
  }

  return unreachable
}
