/**
 * PowerShell-specific permission checking, adapted from bashPermissions.ts
 * for case-insensitive cmdlet matching.
 */

import { resolve } from 'path'
import type { ToolPermissionContext, ToolUseContext } from '../../Tool.js'
import type {
  PermissionDecisionReason,
  PermissionResult,
} from '../../types/permissions.js'
import { getCwd } from '../../utils/cwd.js'
import { isCurrentDirectoryBareGitRepo } from '../../utils/git.js'
import type { PermissionRule } from '../../utils/permissions/PermissionRule.js'
import type { PermissionUpdate } from '../../utils/permissions/PermissionUpdateSchema.js'
import {
  createPermissionRequestMessage,
  getRuleByContentsForToolName,
} from '../../utils/permissions/permissions.js'
import {
  matchWildcardPattern,
  parsePermissionRule,
  type ShellPermissionRule,
  suggestionForExactCommand as sharedSuggestionForExactCommand,
} from '../../utils/permissions/shellRuleMatching.js'
import {
  classifyCommandName,
  deriveSecurityFlags,
  getAllCommandNames,
  getFileRedirections,
  type ParsedCommandElement,
  type ParsedPowerShellCommand,
  PS_TOKENIZER_DASH_CHARS,
  parsePowerShellCommand,
  stripModulePrefix,
} from '../../utils/powershell/parser.js'
import { containsVulnerableUncPath } from '../../utils/shell/readOnlyCommandValidation.js'
import { isDotGitPathPS, isGitInternalPathPS } from './gitSafety.js'
import {
  checkPermissionMode,
  isSymlinkCreatingCommand,
} from './modeValidation.js'
import {
  checkPathConstraints,
  dangerousRemovalDeny,
  isDangerousRemovalRawPath,
} from './pathValidation.js'
import { powershellCommandIsSafe } from './powershellSecurity.js'
import {
  argLeaksValue,
  isAllowlistedCommand,
  isCwdChangingCmdlet,
  isProvablySafeStatement,
  isReadOnlyCommand,
  isSafeOutputCommand,
  resolveToCanonical,
} from './readOnlyValidation.js'
import { POWERSHELL_TOOL_NAME } from './toolName.js'

// Matches `$var = `, `$var += `, `$env:X = `, `$x ??= ` etc. Used to strip
// nested assignment prefixes in the parse-failed fallback path.
const PS_ASSIGN_PREFIX_RE = /^\$[\w:]+\s*(?:[+\-*/%]|\?\?)?\s*=\s*/

/**
 * Cmdlets that can place a file at a caller-specified path. The
 * git-internal-paths guard checks whether any arg is a git-internal path
 * (hooks/, refs/, objects/, HEAD). Non-creating writers (remove-item,
 * clear-content) are intentionally absent — they can't plant new hooks.
 */
const GIT_SAFETY_WRITE_CMDLETS = new Set([
  'new-item',
  'set-content',
  'add-content',
  'out-file',
  'copy-item',
  'move-item',
  'rename-item',
  'expand-archive',
  'invoke-webrequest',
  'invoke-restmethod',
  'tee-object',
  'export-csv',
  'export-clixml',
])

/**
 * External archive-extraction applications that write files to cwd with
 * archive-controlled paths. `tar -xf payload.tar; git status` defeats
 * isCurrentDirectoryBareGitRepo (TOCTOU): the check runs at
 * permission-eval time, tar extracts HEAD/hooks/refs/ AFTER the check and
 * BEFORE git runs. Unlike GIT_SAFETY_WRITE_CMDLETS (where we can inspect
 * args for git-internal paths), archive contents are opaque — any
 * extraction preceding git must ask. Matched by name only (lowercase,
 * with and without .exe).
 */
const GIT_SAFETY_ARCHIVE_EXTRACTORS = new Set([
  'tar',
  'tar.exe',
  'bsdtar',
  'bsdtar.exe',
  'unzip',
  'unzip.exe',
  '7z',
  '7z.exe',
  '7za',
  '7za.exe',
  'gzip',
  'gzip.exe',
  'gunzip',
  'gunzip.exe',
  'expand-archive',
])

/**
 * Extract the command name from a PowerShell command string.
 * Uses the parser to get the first command name from the AST.
 */
async function extractCommandName(command: string): Promise<string> {
  const trimmed = command.trim()
  if (!trimmed) {
    return ''
  }
  const parsed = await parsePowerShellCommand(trimmed)
  const names = getAllCommandNames(parsed)
  return names[0] ?? ''
}

/**
 * Parse a permission rule string into a structured rule object.
 * Delegates to shared parsePermissionRule.
 */
export function powershellPermissionRule(
  permissionRule: string,
): ShellPermissionRule {
  return parsePermissionRule(permissionRule)
}

/**
 * Generate permission update suggestion for exact command match.
 *
 * Skip exact-command suggestion for commands that can't round-trip cleanly:
 * - Multi-line: newlines don't survive normalization, rule would never match
 * - Literal *: storing `Remove-Item * -Force` verbatim re-parses as a wildcard
 *   rule via hasWildcards() (matches `^Remove-Item .* -Force$`). Escaping to
 *   `\*` creates a dead rule — parsePermissionRule's exact branch returns the
 *   raw string with backslash intact, so `Remove-Item \* -Force` never matches
 *   the incoming `Remove-Item * -Force`. Globs are unsafe to exact-auto-allow
 *   anyway; prefix suggestion still offered. (finding #12)
 */
function suggestionForExactCommand(command: string): PermissionUpdate[] {
  if (command.includes('\n') || command.includes('*')) {
    return []
  }
  return sharedSuggestionForExactCommand(POWERSHELL_TOOL_NAME, command)
}

/**
 * PowerShell input schema type - simplified for initial implementation
 */
type PowerShellInput = {
  command: string
  timeout?: number
}

/**
 * Filter rules by contents matching an input command.
 * PowerShell-specific: uses case-insensitive matching throughout.
 * Follows the same structure as BashTool's local filterRulesByContentsMatchingInput.
 */
function filterRulesByContentsMatchingInput(
  input: PowerShellInput,
  rules: Map<string, PermissionRule>,
  matchMode: 'exact' | 'prefix',
  behavior: 'deny' | 'ask' | 'allow',
): PermissionRule[] {
  const command = input.command.trim()

  function strEquals(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase()
  }
  function strStartsWith(str: string, prefix: string): boolean {
    return str.toLowerCase().startsWith(prefix.toLowerCase())
  }
  // SECURITY: stripModulePrefix on RULE names widens the
  // secondary-canonical match — a deny rule `Module\Remove-Item:*` blocking
  // `rm` is the intent (fail-safe over-match), but an allow rule
  // `ModuleA\Get-Thing:*` also matching `ModuleB\Get-Thing` is fail-OPEN.
  // Deny/ask over-match is fine; allow must never over-match.
  function stripModulePrefixForRule(name: string): string {
    if (behavior === 'allow') {
      return name
    }
    return stripModulePrefix(name)
  }

  // Extract the first word (command name) from the input for canonical matching.
  // Keep both raw (for slicing the original `command` string) and stripped
  // (for canonical resolution) versions. For module-qualified inputs like
  // `Microsoft.PowerShell.Utility\Invoke-Expression foo`, rawCmdName holds the
  // full token so `command.slice(rawCmdName.length)` yields the correct rest.
  const rawCmdName = command.split(/\s+/)[0] ?? ''
  const inputCmdName = stripModulePrefix(rawCmdName)
  const inputCanonical = resolveToCanonical(inputCmdName)

  // Build a version of the command with the canonical name substituted
  // e.g., 'rm foo.txt' -> 'remove-item foo.txt' so deny rules on Remove-Item also block rm.
  // SECURITY: Normalize the whitespace separator between name and args to a
  // single space. PowerShell accepts any whitespace (tab, etc.) as separator,
  // but prefix rule matching uses `prefix + ' '` (literal space). Without this,
  // `rm\t./x` canonicalizes to `remove-item\t./x` and misses the deny rule
  // `Remove-Item:*`, while acceptEdits auto-allow (using AST cmd.name) still
  // matches — a deny-rule bypass. Build unconditionally (not just when the
  // canonical differs) so non-space-separated raw commands are also normalized.
  const rest = command.slice(rawCmdName.length).replace(/^\s+/, ' ')
  const canonicalCommand = inputCanonical + rest

  return Array.from(rules.entries())
    .filter(([ruleContent]) => {
      const rule = powershellPermissionRule(ruleContent)

      // Also resolve the rule's command name to canonical for cross-matching
      // e.g., a deny rule for 'rm' should also block 'Remove-Item'
      function matchesCommand(cmd: string): boolean {
        switch (rule.type) {
          case 'exact':
            return strEquals(rule.command, cmd)
          case 'prefix':
            switch (matchMode) {
              case 'exact':
                return strEquals(rule.prefix, cmd)
              case 'prefix': {
                if (strEquals(cmd, rule.prefix)) {
                  return true
                }
                return strStartsWith(cmd, rule.prefix + ' ')
              }
            }
            break
          case 'wildcard':
            if (matchMode === 'exact') {
              return false
            }
            return matchWildcardPattern(rule.pattern, cmd, true)
        }
      }

      // Check against the original command
      if (matchesCommand(command)) {
        return true
      }

      // Also check against the canonical form of the command
      // This ensures 'deny Remove-Item' also blocks 'rm', 'del', 'ri', etc.
      if (matchesCommand(canonicalCommand)) {
        return true
      }

      // Also resolve the rule's command name to canonical and compare
      // This ensures 'deny rm' also blocks 'Remove-Item'
      // SECURITY: stripModulePrefix applied to DENY/ASK rule command
      // names too, not just input. Otherwise a deny rule written as
      // `Microsoft.PowerShell.Management\Remove-Item:*` is bypassed by `rm`,
      // `del`, or plain `Remove-Item` — resolveToCanonical won't match the
      // module-qualified form against COMMON_ALIASES.
      if (rule.type === 'exact') {
        const rawRuleCmdName = rule.command.split(/\s+/)[0] ?? ''
        const ruleCanonical = resolveToCanonical(
          stripModulePrefixForRule(rawRuleCmdName),
        )
        if (ruleCanonical === inputCanonical) {
          // Rule and input resolve to same canonical cmdlet
          // SECURITY: use normalized `rest` not a raw re-slice
          // from `command`. The raw slice preserves tab separators so
          // `Remove-Item\t./secret.txt` vs deny rule `rm ./secret.txt` misses.
          // Normalize both sides identically.
          const ruleRest = rule.command
            .slice(rawRuleCmdName.length)
            .replace(/^\s+/, ' ')
          const inputRest = rest
          if (strEquals(ruleRest, inputRest)) {
            return true
          }
        }
      } else if (rule.type === 'prefix') {
        const rawRuleCmdName = rule.prefix.split(/\s+/)[0] ?? ''
        const ruleCanonical = resolveToCanonical(
          stripModulePrefixForRule(rawRuleCmdName),
        )
        if (ruleCanonical === inputCanonical) {
          const ruleRest = rule.prefix
            .slice(rawRuleCmdName.length)
            .replace(/^\s+/, ' ')
          const canonicalPrefix = inputCanonical + ruleRest
          if (matchMode === 'exact') {
            if (strEquals(canonicalPrefix, canonicalCommand)) {
              return true
            }
          } else {
            if (
              strEquals(canonicalCommand, canonicalPrefix) ||
              strStartsWith(canonicalCommand, canonicalPrefix + ' ')
            ) {
              return true
            }
          }
        }
      } else if (rule.type === 'wildcard') {
        // Resolve the wildcard pattern's command name to canonical and re-match
        // This ensures 'deny rm *' also blocks 'Remove-Item secret.txt'
        const rawRuleCmdName = rule.pattern.split(/\s+/)[0] ?? ''
        const ruleCanonical = resolveToCanonical(
          stripModulePrefixForRule(rawRuleCmdName),
        )
        if (ruleCanonical === inputCanonical && matchMode !== 'exact') {
          // Rebuild the pattern with the canonical cmdlet name
          // Normalize separator same as exact and prefix branches.
          // Without this, a wildcard rule `rm\t*` produces canonicalPattern
          // with a literal tab that never matches the space-normalized
          // canonicalCommand.
          const ruleRest = rule.pattern
            .slice(rawRuleCmdName.length)
            .replace(/^\s+/, ' ')
          const canonicalPattern = inputCanonical + ruleRest
          if (matchWildcardPattern(canonicalPattern, canonicalCommand, true)) {
            return true
          }
        }
      }

      return false
    })
    .map(([, rule]) => rule)
}

/**
 * Get matching rules for input across all rule types (deny, ask, allow)
 */
function matchingRulesForInput(
  input: PowerShellInput,
  toolPermissionContext: ToolPermissionContext,
  matchMode: 'exact' | 'prefix',
) {
  const denyRuleByContents = getRuleByContentsForToolName(
    toolPermissionContext,
    POWERSHELL_TOOL_NAME,
    'deny',
  )
  const matchingDenyRules = filterRulesByContentsMatchingInput(
    input,
    denyRuleByContents,
    matchMode,
    'deny',
  )

  const askRuleByContents = getRuleByContentsForToolName(
    toolPermissionContext,
    POWERSHELL_TOOL_NAME,
    'ask',
  )
  const matchingAskRules = filterRulesByContentsMatchingInput(
    input,
    askRuleByContents,
    matchMode,
    'ask',
  )

  const allowRuleByContents = getRuleByContentsForToolName(
    toolPermissionContext,
    POWERSHELL_TOOL_NAME,
    'allow',
  )
  const matchingAllowRules = filterRulesByContentsMatchingInput(
    input,
    allowRuleByContents,
    matchMode,
    'allow',
  )

  return { matchingDenyRules, matchingAskRules, matchingAllowRules }
}

/**
 * Check if the command is an exact match for a permission rule.
 */
export function powershellToolCheckExactMatchPermission(
  input: PowerShellInput,
  toolPermissionContext: ToolPermissionContext,
): PermissionResult {
  const trimmedCommand = input.command.trim()
  const { matchingDenyRules, matchingAskRules, matchingAllowRules } =
    matchingRulesForInput(input, toolPermissionContext, 'exact')

  if (matchingDenyRules[0] !== undefined) {
    return {
      behavior: 'deny',
      message: `Permission to use ${POWERSHELL_TOOL_NAME} with command ${trimmedCommand} has been denied.`,
      decisionReason: { type: 'rule', rule: matchingDenyRules[0] },
    }
  }

  if (matchingAskRules[0] !== undefined) {
    return {
      behavior: 'ask',
      message: createPermissionRequestMessage(POWERSHELL_TOOL_NAME),
      decisionReason: { type: 'rule', rule: matchingAskRules[0] },
    }
  }

  if (matchingAllowRules[0] !== undefined) {
    return {
      behavior: 'allow',
      updatedInput: input,
      decisionReason: { type: 'rule', rule: matchingAllowRules[0] },
    }
  }

  const decisionReason: PermissionDecisionReason = {
    type: 'other' as const,
    reason: 'This command requires approval',
  }
  return {
    behavior: 'passthrough',
    message: createPermissionRequestMessage(
      POWERSHELL_TOOL_NAME,
      decisionReason,
    ),
    decisionReason,
    suggestions: suggestionForExactCommand(trimmedCommand),
  }
}

/**
 * Check permission for a PowerShell command including prefix matches.
 */
export function powershellToolCheckPermission(
  input: PowerShellInput,
  toolPermissionContext: ToolPermissionContext,
): PermissionResult {
  const command = input.command.trim()

  // 1. Check exact match first
  const exactMatchResult = powershellToolCheckExactMatchPermission(
    input,
    toolPermissionContext,
  )

  // 1a. Deny/ask if exact command has a rule
  if (
    exactMatchResult.behavior === 'deny' ||
    exactMatchResult.behavior === 'ask'
  ) {
    return exactMatchResult
  }

  // 2. Find all matching rules (prefix or exact)
  const { matchingDenyRules, matchingAskRules, matchingAllowRules } =
    matchingRulesForInput(input, toolPermissionContext, 'prefix')

  // 2a. Deny if command has a deny rule
  if (matchingDenyRules[0] !== undefined) {
    return {
      behavior: 'deny',
      message: `Permission to use ${POWERSHELL_TOOL_NAME} with command ${command} has been denied.`,
      decisionReason: {
        type: 'rule',
        rule: matchingDenyRules[0],
      },
    }
  }

  // 2b. Ask if command has an ask rule
  if (matchingAskRules[0] !== undefined) {
    return {
      behavior: 'ask',
      message: createPermissionRequestMessage(POWERSHELL_TOOL_NAME),
      decisionReason: {
        type: 'rule',
        rule: matchingAskRules[0],
      },
    }
  }

  // 3. Allow if command had an exact match allow
  if (exactMatchResult.behavior === 'allow') {
    return exactMatchResult
  }

  // 4. Allow if command has an allow rule
  if (matchingAllowRules[0] !== undefined) {
    return {
      behavior: 'allow',
      updatedInput: input,
      decisionReason: {
        type: 'rule',
        rule: matchingAllowRules[0],
      },
    }
  }

  // 5. Passthrough since no rules match, will trigger permission prompt
  const decisionReason = {
    type: 'other' as const,
    reason: 'This command requires approval',
  }
  return {
    behavior: 'passthrough',
    message: createPermissionRequestMessage(
      POWERSHELL_TOOL_NAME,
      decisionReason,
    ),
    decisionReason,
    suggestions: suggestionForExactCommand(command),
  }
}

/**
 * Information about a sub-command for permission checking.
 */
type SubCommandInfo = {
  text: string
  element: ParsedCommandElement
  statement: ParsedPowerShellCommand['statements'][number] | null
  isSafeOutput: boolean
}

/**
 * Extract sub-commands that need independent permission checking from a parsed command.
 * Safe output cmdlets (Format-Table, Select-Object, etc.) are flagged but NOT
 * filtered out — step 4.4 still checks deny rules against them (deny always
 * wins), step 5 skips them for approval collection (they inherit the permission
 * of the preceding command).
 *
 * Also includes nested commands from control flow statements (if, for, foreach, etc.)
 * to ensure commands hidden inside control flow are checked.
 *
 * Returns sub-command info including both text and the parsed element for accurate
 * suggestion generation.
 */
async function getSubCommandsForPermissionCheck(
  parsed: ParsedPowerShellCommand,
  originalCommand: string,
): Promise<SubCommandInfo[]> {
  if (!parsed.valid) {
    // Return a fallback element for unparsed commands
    return [
      {
        text: originalCommand,
        element: {
          name: await extractCommandName(originalCommand),
          nameType: 'unknown',
          elementType: 'CommandAst',
          args: [],
          text: originalCommand,
        },
        statement: null,
        isSafeOutput: false,
      },
    ]
  }

  const subCommands: SubCommandInfo[] = []

  // Check direct commands in pipelines
  for (const statement of parsed.statements) {
    for (const cmd of statement.commands) {
      // Only check actual commands (CommandAst), not expressions
      if (cmd.elementType !== 'CommandAst') {
        continue
      }
      subCommands.push({
        text: cmd.text,
        element: cmd,
        statement,
        // SECURITY: nameType gate — scripts\\Out-Null strips to Out-Null and
        // would match SAFE_OUTPUT_CMDLETS, but PowerShell runs the .ps1 file.
        // isSafeOutput: true causes step 5 to filter this command out of the
        // approval list, so it would silently execute. See isAllowlistedCommand.
        // SECURITY: args.length === 0 gate — Out-Null -InputObject:(1 > /etc/x)
        // was filtered as safe-output (name-only) → step-5 subCommands empty →
        // auto-allow → redirection inside paren writes file. Only zero-arg
        // Out-String/Out-Null/Out-Host invocations are provably safe.
        isSafeOutput:
          cmd.nameType !== 'application' &&
          isSafeOutputCommand(cmd.name) &&
          cmd.args.length === 0,
      })
    }

    // Also check nested commands from control flow statements
    if (statement.nestedCommands) {
      for (const cmd of statement.nestedCommands) {
        subCommands.push({
          text: cmd.text,
          element: cmd,
          statement,
          isSafeOutput:
            cmd.nameType !== 'application' &&
            isSafeOutputCommand(cmd.name) &&
            cmd.args.length === 0,
        })
      }
    }
  }

  if (subCommands.length > 0) {
    return subCommands
  }

  // Fallback for commands with no sub-commands
  return [
    {
      text: originalCommand,
      element: {
        name: await extractCommandName(originalCommand),
        nameType: 'unknown',
        elementType: 'CommandAst',
        args: [],
        text: originalCommand,
      },
      statement: null,
      isSafeOutput: false,
    },
  ]
}

/**
 * Main permission check function for PowerShell tool.
 *
 * This function implements the full permission flow:
 * 1. Check exact match against deny/ask/allow rules
 * 2. Check prefix match against rules
 * 3. Run security check via powershellCommandIsSafe()
 * 4. Return appropriate PermissionResult
 *
 * @param input - The PowerShell tool input
 * @param context - The tool use context (for abort signal and session info)
 * @returns Promise resolving to PermissionResult
 */
export async function powershellToolHasPermission(
  input: PowerShellInput,
  context: ToolUseContext,
): Promise<PermissionResult> {
  const toolPermissionContext = context.getAppState().toolPermissionContext
  const command = input.command.trim()

  // Empty command check
  if (!command) {
    return {
      behavior: 'allow',
      updatedInput: input,
      decisionReason: {
        type: 'other',
        reason: 'Empty command is safe',
      },
    }
  }

  // Parse the command once and thread through all sub-functions
  const parsed = await parsePowerShellCommand(command)

  // SECURITY: Check deny/ask rules BEFORE parse validity check.
  // Deny rules operate on the raw command string and don't need the parsed AST.
  // This ensures explicit deny rules still block commands even when parsing fails.
  // 1. Check exact match first
  const exactMatchResult = powershellToolCheckExactMatchPermission(
    input,
    toolPermissionContext,
  )

  // Exact command was denied
  if (exactMatchResult.behavior === 'deny') {
    return exactMatchResult
  }

  // 2. Check prefix/wildcard rules
  const { matchingDenyRules, matchingAskRules } = matchingRulesForInput(
    input,
    toolPermissionContext,
    'prefix',
  )

  // 2a. Deny if command has a deny rule
  if (matchingDenyRules[0] !== undefined) {
    return {
      behavior: 'deny',
      message: `Permission to use ${POWERSHELL_TOOL_NAME} with command ${command} has been denied.`,
      decisionReason: {
        type: 'rule',
        rule: matchingDenyRules[0],
      },
    }
  }

  // 2b. Ask if command has an ask rule — DEFERRED into decisions[].
  // Previously this early-returned before sub-command deny checks ran, so
  // `Get-Process; Invoke-Expression evil` with ask(Get-Process:*) +
  // deny(Invoke-Expression:*) would show the ask dialog and the deny never
  // fired. Now: store the ask, push into decisions[] after parse succeeds.
  // If parse fails, returned before the parse-error ask (preserves the
  // rule-attributed decisionReason when pwsh is unavailable).
  let preParseAskDecision: PermissionResult | null = null
  if (matchingAskRules[0] !== undefined) {
    preParseAskDecision = {
      behavior: 'ask',
      message: createPermissionRequestMessage(POWERSHELL_TOOL_NAME),
      decisionReason: {
        type: 'rule',
        rule: matchingAskRules[0],
      },
    }
  }

  // Block UNC paths — reading from UNC paths can trigger network requests
  // and leak NTLM/Kerberos credentials. DEFERRED into decisions[].
  // The raw-string UNC check must not early-return before sub-command deny
  // (step 4+). Same fix as 2b above.
  if (preParseAskDecision === null && containsVulnerableUncPath(command)) {
    preParseAskDecision = {
      behavior: 'ask',
      message:
        'Command contains a UNC path that could trigger network requests',
    }
  }

  // 2c. Exact allow rules short-circuit here ONLY when parsing failed AND
  // no pre-parse ask (2b prefix or UNC) is pending. Converting 2b/UNC from
  // early-return to deferred-assign meant 2c
  // fired before L648 consumed preParseAskDecision — silently overriding the
  // ask with allow. Parse-succeeded path enforces ask > allow via the reduce
  // (L917); without this guard, parse-failed was inconsistent.
  // This ensures user-configured exact allow rules work even when pwsh is
  // unavailable. When parsing succeeds, the exact allow check is deferred to
  // after step 4.4 (sub-command deny/ask) — matching BashTool's ordering where
  // the main-flow exact allow at bashPermissions.ts:1520 runs after sub-command
  // deny checks (1442-1458). Without this, an exact allow on a compound command
  // would bypass deny rules on sub-commands.
  //
  // SECURITY (parse-failed branch): the nameType guard in step 5 lives
  // inside the sub-command loop, which only runs when parsed.valid.
  // This is the !parsed.valid escape hatch. Input-side stripModulePrefix
  // is unconditional — `scripts\build.exe --flag` strips to `build.exe`,
  // canonicalCommand matches exact allow, and without this guard we'd
  // return allow here and execute the local script. classifyCommandName
  // is a pure string function (no AST needed). `scripts\build.exe` →
  // 'application' (has `\`). Same tradeoff as step 5: `build.exe` alone
  // also classifies 'application' (has `.`) so legitimate executable
  // exact-allows downgrade to ask when pwsh is degraded — fail-safe.
  // Module-qualified cmdlets (Module\Cmdlet) also classify 'application'
  // (same `\`); same fail-safe over-fire.
  if (
    exactMatchResult.behavior === 'allow' &&
    !parsed.valid &&
    preParseAskDecision === null &&
    classifyCommandName(command.split(/\s+/)[0] ?? '') !== 'application'
  ) {
    return exactMatchResult
  }

  // 0. Check if command can be parsed - if not, require approval but don't suggest persisting
  // This matches Bash behavior: invalid syntax triggers a permission prompt but we don't
  // recommend saving invalid commands to settings
  // NOTE: This check is intentionally AFTER deny/ask rules so explicit rules still work
  // even when the parser fails (e.g., pwsh unavailable).
  if (!parsed.valid) {
    // SECURITY: Fallback sub-command deny scan for parse-failed path.
    // The sub-command deny loop at L851+ needs the AST; when parsing fails
    // (command exceeds MAX_COMMAND_LENGTH, pwsh unavailable, timeout, bad
    // JSON), we'd return 'ask' without ever checking sub-command deny rules.
    // Attack: `Get-ChildItem # <~2000 chars padding> ; Invoke-Expression evil`
    // → padding forces valid=false → generic ask prompt, deny(iex:*) never
    // fires. This fallback splits on PowerShell separators/grouping and runs
    // each fragment through the SAME rule matcher as step 2a (prefix deny).
    // Conservative: fragments inside string literals/comments may false-positive
    // deny — safe here (parse-failed is already a degraded state, and this is
    // a deny-DOWNGRADE fix). Match against full fragment (not just first token)
    // so multi-word rules like `Remove-Item foo:*` still fire; the matcher's
    // canonical resolution handles aliases (`iex` → `Invoke-Expression`).
    //
    // SECURITY: backtick is PS escape/line-continuation, NOT a separator.
    // Splitting on it would fragment `Invoke-Ex`pression` into non-matching
    // pieces. Instead: collapse backtick-newline (line continuation) so
    // `Invoke-Ex`<nl>pression` rejoins, strip remaining backticks (escape
    // chars — ``x → x), then split on actual statement/grouping separators.
    const backtickStripped = command
      .replace(/`[\r\n]+\s*/g, '')
      .replace(/`/g, '')
    for (const fragment of backtickStripped.split(/[;|\n\r{}()&]+/)) {
      const trimmedFrag = fragment.trim()
      if (!trimmedFrag) continue // skip empty fragments
      // Skip the full command ONLY if it starts with a cmdlet name (no
      // assignment prefix). The full command was already checked at 2a, but
      // 2a uses the raw text — $x %= iex as first token `$x` misses the
      // deny(iex:*) rule. If normalization would change the fragment
      // (assignment prefix, dot-source), don't skip — let it be re-checked
      // after normalization. (bug #10/#24)
      if (
        trimmedFrag === command &&
        !/^\$[\w:]/.test(trimmedFrag) &&
        !/^[&.]\s/.test(trimmedFrag)
      ) {
        continue
      }
      // SECURITY: Normalize invocation-operator and assignment prefixes before
      // rule matching (findings #5/#22). The splitter gives us the raw fragment
      // text; matchingRulesForInput extracts the first token as the cmdlet name.
      // Without normalization:
      //   `$x = Invoke-Expression 'p'` → first token `$x` → deny(iex:*) misses
      //   `. Invoke-Expression 'p'`    → first token `.`  → deny(iex:*) misses
      //   `& 'Invoke-Expression' 'p'`  → first token `&` removed by split but
      //                                  `'Invoke-Expression'` retains quotes
      //                                  → deny(iex:*) misses
      // The parse-succeeded path handles these via AST (parser.ts:839 strips
      // quotes from rawNameUnstripped; invocation operators are separate AST
      // nodes). This fallback mirrors that normalization.
      // Loop strips nested assignments: $x = $y = iex → $y = iex → iex
      let normalized = trimmedFrag
      let m: RegExpMatchArray | null
      while ((m = normalized.match(PS_ASSIGN_PREFIX_RE))) {
        normalized = normalized.slice(m[0].length)
      }
      normalized = normalized.replace(/^[&.]\s+/, '') // & cmd, . cmd (dot-source)
      const rawFirst = normalized.split(/\s+/)[0] ?? ''
      const firstTok = rawFirst.replace(/^['"]|['"]$/g, '')
      const normalizedFrag = firstTok + normalized.slice(rawFirst.length)
      // SECURITY: parse-independent dangerous-removal hard-deny. The
      // isDangerousRemovalPath check in checkPathConstraintsForStatement
      // requires a valid AST; when pwsh times out or is unavailable,
      // `Remove-Item /` degrades from hard-deny to generic ask. Check
      // raw positional args here so root/home/system deletion is denied
      // regardless of parser availability. Conservative: only positional
      // args (skip -Param tokens); over-deny in degraded state is safe
      // (same deny-downgrade rationale as the sub-command scan above).
      if (resolveToCanonical(firstTok) === 'remove-item') {
        for (const arg of normalized.split(/\s+/).slice(1)) {
          if (PS_TOKENIZER_DASH_CHARS.has(arg[0] ?? '')) continue
          if (isDangerousRemovalRawPath(arg)) {
            return dangerousRemovalDeny(arg)
          }
        }
      }
      const { matchingDenyRules: fragDenyRules } = matchingRulesForInput(
        { command: normalizedFrag },
        toolPermissionContext,
        'prefix',
      )
      if (fragDenyRules[0] !== undefined) {
        return {
          behavior: 'deny',
          message: `Permission to use ${POWERSHELL_TOOL_NAME} with command ${command} has been denied.`,
          decisionReason: { type: 'rule', rule: fragDenyRules[0] },
        }
      }
    }
    // Preserve pre-parse ask messaging when parse fails. The deferred ask
    // (2b prefix rule or UNC) carries a better decisionReason than the
    // generic parse-error ask. Sub-command deny can't run the AST loop
    // without a parse, so the fallback scan above is best-effort.
    if (preParseAskDecision !== null) {
      return preParseAskDecision
    }
    const decisionReason = {
      type: 'other' as const,
      reason: `Command contains malformed syntax that cannot be parsed: ${parsed.errors[0]?.message ?? 'unknown error'}`,
    }
    return {
      behavior: 'ask',
      decisionReason,
      message: createPermissionRequestMessage(
        POWERSHELL_TOOL_NAME,
        decisionReason,
      ),
      // No suggestions - don't recommend persisting invalid syntax
    }
  }

  // ========================================================================
  // COLLECT-THEN-REDUCE: post-parse decisions (deny > ask > allow > passthrough)
  // ========================================================================
  // Ported from bashPermissions.ts:1446-1472. Every post-parse check pushes
  // its decision into a single array; a single reduce applies precedence.
  // This structurally closes the ask-before-deny bug class: an 'ask' from an
  // earlier check (security flags, provider paths, cd+git) can no longer mask
  // a 'deny' from a later check (sub-command deny, checkPathConstraints).
  //
  // Supersedes the firstSubCommandAskRule stash from commit 8f5ae6c56b — that
  // fix only patched step 4; steps 3, 3.5, 4.42 had the same flaw. The stash
  // pattern is also fragile: the next author who writes `return ask` is back
  // where we started. Collect-then-reduce makes the bypass impossible to write.
  //
  // First-of-each-behavior wins (array order = step order), so single-check
  // ask messages are unchanged vs. sequential-early-return.
  //
  // Pre-parse deny checks above (exact/prefix deny) stay sequential: they
  // fire even when pwsh is unavailable. Pre-parse asks (prefix ask, raw UNC)
  // are now deferred here so sub-command deny (step 4) beats them.

  // Gather sub-commands once (used by decisions 3, 4, and fallthrough step 5).
  const allSubCommands = await getSubCommandsForPermissionCheck(parsed, command)

  const decisions: PermissionResult[] = []

  // Decision: deferred pre-parse ask (2b prefix ask or UNC path).
  // Pushed first so its message wins over later asks (first-of-behavior wins),
  // but the reduce ensures any deny in decisions[] still beats it.
  if (preParseAskDecision !== null) {
    decisions.push(preParseAskDecision)
  }

  // Decision: security check — was step 3 (:630-650).
  // powershellCommandIsSafe returns 'ask' for subexpressions, script blocks,
  // encoded commands, download cradles, etc. Only 'ask' | 'passthrough'.
  const safetyResult = powershellCommandIsSafe(command, parsed)
  if (safetyResult.behavior !== 'passthrough') {
    const decisionReason: PermissionDecisionReason = {
      type: 'other' as const,
      reason:
        safetyResult.behavior === 'ask' && safetyResult.message
          ? safetyResult.message
          : 'This command contains patterns that could pose security risks and requires approval',
    }
    decisions.push({
      behavior: 'ask',
      message: createPermissionRequestMessage(
        POWERSHELL_TOOL_NAME,
        decisionReason,
      ),
      decisionReason,
      suggestions: suggestionForExactCommand(command),
    })
  }

  // Decision: using statements / script requirements — invisible to AST block walk.
  // `using module ./evil.psm1` loads and executes a module's top-level script body;
  // `using assembly ./evil.dll` loads a .NET assembly (module initializers run).
  // `#Requires -Modules <name>` triggers module loading from PSModulePath.
  // These are siblings of the named blocks on ScriptBlockAst, not children, so
  // Process-BlockStatements and all downstream command walkers never see them.
  // Without this check, a decoy cmdlet like Get-Process fills subCommands,
  // bypassing the empty-statement fallback, and isReadOnlyCommand auto-allows.
  if (parsed.hasUsingStatements) {
    const decisionReason: PermissionDecisionReason = {
      type: 'other' as const,
      reason:
        'Command contains a `using` statement that may load external code (module or assembly)',
    }
    decisions.push({
      behavior: 'ask',
      message: createPermissionRequestMessage(
        POWERSHELL_TOOL_NAME,
        decisionReason,
      ),
      decisionReason,
      suggestions: suggestionForExactCommand(command),
    })
  }
  if (parsed.hasScriptRequirements) {
    const decisionReason: PermissionDecisionReason = {
      type: 'other' as const,
      reason:
        'Command contains a `#Requires` directive that may trigger module loading',
    }
    decisions.push({
      behavior: 'ask',
      message: createPermissionRequestMessage(
        POWERSHELL_TOOL_NAME,
        decisionReason,
      ),
      decisionReason,
      suggestions: suggestionForExactCommand(command),
    })
  }

  // Decision: resolved-arg provider/UNC scan — was step 3.5 (:652-709).
  // Provider paths (env:, HKLM:, function:) access non-filesystem resources.
  // UNC paths can leak NTLM/Kerberos credentials on Windows. The raw-string
  // UNC check above (pre-parse) misses backtick-escaped forms; cmd.args has
  // backtick escapes resolved by the parser. Labeled loop breaks on FIRST
  // match (same as the previous early-return).
  // Provider prefix matches both the short form (`env:`, `HKLM:`) and the
  // fully-qualified form (`Microsoft.PowerShell.Core\Registry::HKLM\...`).
  // The optional `(?:[\w.]+\\)?` handles the module-qualified prefix; `::?`
  // matches either single-colon drive syntax or double-colon provider syntax.
  const NON_FS_PROVIDER_PATTERN =
    /^(?:[\w.]+\\)?(env|hklm|hkcu|function|alias|variable|cert|wsman|registry)::?/i
  function extractProviderPathFromArg(arg: string): string {
    // Handle colon parameter syntax: -Path:env:HOME → extract 'env:HOME'.
    // SECURITY: PowerShell's tokenizer accepts en-dash/em-dash/horizontal-bar
    // (U+2013/2014/2015) as parameter prefixes. `–Path:env:HOME` (en-dash)
    // must also strip the `–Path:` prefix or NON_FS_PROVIDER_PATTERN won't
    // match (pattern is `^(env|...):` which fails on `–Path:env:...`).
    let s = arg
    if (s.length > 0 && PS_TOKENIZER_DASH_CHARS.has(s[0]!)) {
      const colonIdx = s.indexOf(':', 1) // skip the leading dash
      if (colonIdx > 0) {
        s = s.substring(colonIdx + 1)
      }
    }
    // Strip backtick escapes before matching: `Registry`::HKLM\...` has a
    // backtick before `::` that the PS tokenizer removes at runtime but that
    // would otherwise prevent the ^-anchored pattern from matching.
    return s.replace(/`/g, '')
  }
  function providerOrUncDecisionForArg(arg: string): PermissionResult | null {
    const value = extractProviderPathFromArg(arg)
    if (NON_FS_PROVIDER_PATTERN.test(value)) {
      return {
        behavior: 'ask',
        message: `Command argument '${arg}' uses a non-filesystem provider path and requires approval`,
      }
    }
    if (containsVulnerableUncPath(value)) {
      return {
        behavior: 'ask',
        message: `Command argument '${arg}' contains a UNC path that could trigger network requests`,
      }
    }
    return null
  }
  providerScan: for (const statement of parsed.statements) {
    for (const cmd of statement.commands) {
      if (cmd.elementType !== 'CommandAst') continue
      for (const arg of cmd.args) {
        const decision = providerOrUncDecisionForArg(arg)
        if (decision !== null) {
          decisions.push(decision)
          break providerScan
        }
      }
    }
    if (statement.nestedCommands) {
      for (const cmd of statement.nestedCommands) {
        for (const arg of cmd.args) {
          const decision = providerOrUncDecisionForArg(arg)
          if (decision !== null) {
            decisions.push(decision)
            break providerScan
          }
        }
      }
    }
  }

  // Decision: per-sub-command deny/ask rules — was step 4 (:711-803).
  // Each sub-command produces at most one decision (deny or ask). Deny rules
  // on LATER sub-commands still beat ask rules on EARLIER ones via the reduce.
  // No stash needed — the reduce structurally enforces deny > ask.
  //
  // SECURITY: Always build a canonical command string from AST-derived data
  // (element.name + space-joined args) and check rules against it too. Deny
  // and allow must use the same normalized form to close asymmetries:
  //   - Invocation operators (`& 'Remove-Item' ./x`): raw text starts with `&`,
  //     splitting on whitespace yields the operator, not the cmdlet name.
  //   - Non-space whitespace (`rm\t./x`): raw prefix match uses `prefix + ' '`
  //     (literal space), but PowerShell accepts any whitespace separator.
  //     checkPermissionMode auto-allow (using AST cmd.name) WOULD match while
  //     deny-rule match on raw text would miss — a deny-rule bypass.
  //   - Module prefixes (`Microsoft.PowerShell.Management\Remove-Item`):
  //     element.name has the module prefix stripped.
  for (const { text: subCmd, element } of allSubCommands) {
    // element.name is quote-stripped at the parser (transformCommandAst) so
    // `& 'Invoke-Expression' 'x'` yields name='Invoke-Expression', not
    // "'Invoke-Expression'". canonicalSubCmd is built from the same stripped
    // name, so deny-rule prefix matching on `Invoke-Expression:*` hits.
    const canonicalSubCmd =
      element.name !== '' ? [element.name, ...element.args].join(' ') : null

    const subInput = { command: subCmd }
    const { matchingDenyRules: subDenyRules, matchingAskRules: subAskRules } =
      matchingRulesForInput(subInput, toolPermissionContext, 'prefix')
    let matchedDenyRule = subDenyRules[0]
    let matchedAskRule = subAskRules[0]

    if (matchedDenyRule === undefined && canonicalSubCmd !== null) {
      const {
        matchingDenyRules: canonicalDenyRules,
        matchingAskRules: canonicalAskRules,
      } = matchingRulesForInput(
        { command: canonicalSubCmd },
        toolPermissionContext,
        'prefix',
      )
      matchedDenyRule = canonicalDenyRules[0]
      if (matchedAskRule === undefined) {
        matchedAskRule = canonicalAskRules[0]
      }
    }

    if (matchedDenyRule !== undefined) {
      decisions.push({
        behavior: 'deny',
        message: `Permission to use ${POWERSHELL_TOOL_NAME} with command ${command} has been denied.`,
        decisionReason: {
          type: 'rule',
          rule: matchedDenyRule,
        },
      })
    } else if (matchedAskRule !== undefined) {
      decisions.push({
        behavior: 'ask',
        message: createPermissionRequestMessage(POWERSHELL_TOOL_NAME),
        decisionReason: {
          type: 'rule',
          rule: matchedAskRule,
        },
      })
    }
  }

  // Decision: cd+git compound guard — was step 4.42 (:805-833).
  // When cd/Set-Location is paired with git, don't allow without prompting —
  // cd to a malicious directory makes git dangerous (fake hooks, bare repo
  // attacks). Collect-then-reduce keeps the improvement over BashTool: in
  // bash, cd+git (B9, line 1416) runs BEFORE sub-command deny (B11), so cd+git
  // ask masks deny. Here, both are in the same decision array; deny wins.
  //
  // SECURITY: NO cd-to-CWD no-op exclusion. A previous iteration excluded
  // `Set-Location .` as a no-op, but the "first non-dash arg" heuristic used
  // to extract the target is fooled by colon-bound params:
  // `Set-Location -Path:/etc .` — real target is /etc, heuristic sees `.`,
  // exclusion fires, bypass. The UX case (model emitting `Set-Location .; foo`)
  // is rare; the attack surface isn't worth the special-case. Any cd-family
  // cmdlet in the compound sets this flag, period.
  // Only flag compound cd when there are multiple sub-commands. A standalone
  // `Set-Location ./subdir` is not a TOCTOU risk (no later statement resolves
  // relative paths against stale cwd). Without this, standalone cd forces the
  // compound guard, suppressing the per-subcommand auto-allow path. (bug #25)
  const hasCdSubCommand =
    allSubCommands.length > 1 &&
    allSubCommands.some(({ element }) => isCwdChangingCmdlet(element.name))
  // Symlink-create compound guard (finding #18 / bug 001+004): when the
  // compound creates a filesystem link, subsequent writes through that link
  // land outside the validator's view. Same TOCTOU shape as cwd desync.
  const hasSymlinkCreate =
    allSubCommands.length > 1 &&
    allSubCommands.some(({ element }) => isSymlinkCreatingCommand(element))
  const hasGitSubCommand = allSubCommands.some(
    ({ element }) => resolveToCanonical(element.name) === 'git',
  )
  if (hasCdSubCommand && hasGitSubCommand) {
    decisions.push({
      behavior: 'ask',
      message:
        'Compound commands with cd/Set-Location and git require approval to prevent bare repository attacks',
    })
  }

  // cd+write compound guard — SUBSUMED by checkPathConstraints(compoundCommandHasCd).
  // Previously this block pushed 'ask' when hasCdSubCommand && hasAcceptEditsWrite,
  // but checkPathConstraints now receives hasCdSubCommand and pushes 'ask' for ANY
  // path operation (read or write) in a cd-compound — broader coverage at the path
  // layer (BashTool parity). The step-5 !hasCdSubCommand gates and modeValidation's
  // compound-cd guard remain as defense-in-depth for paths that don't reach
  // checkPathConstraints (e.g., cmdlets not in CMDLET_PATH_CONFIG).

  // Decision: bare-git-repo guard — bash parity.
  // If cwd has HEAD/objects/refs/ without a valid .git/HEAD, Git treats
  // cwd as a bare repository and runs hooks from cwd. Attacker creates
  // hooks/pre-commit, deletes .git/HEAD, then any git subcommand runs it.
  // Port of BashTool readOnlyValidation.ts isCurrentDirectoryBareGitRepo.
  if (hasGitSubCommand && isCurrentDirectoryBareGitRepo()) {
    decisions.push({
      behavior: 'ask',
      message:
        'Git command in a directory with bare-repository indicators (HEAD, objects/, refs/ in cwd without .git/HEAD). Git may execute hooks from cwd.',
    })
  }

  // Decision: git-internal-paths write guard — bash parity.
  // Compound command creates HEAD/objects/refs/hooks/ then runs git → the
  // git subcommand executes freshly-created malicious hooks. Check all
  // extracted write paths + redirection targets against git-internal patterns.
  // Port of BashTool commandWritesToGitInternalPaths, adapted for AST.
  if (hasGitSubCommand) {
    const writesToGitInternal = allSubCommands.some(
      ({ element, statement }) => {
        // Redirection targets on this sub-command (raw Extent.Text — quotes
        // and ./ intact; normalizer handles both)
        for (const r of element.redirections ?? []) {
          if (isGitInternalPathPS(r.target)) return true
        }
        // Write cmdlet args (new-item HEAD; mkdir hooks; set-content hooks/pre-commit)
        const canonical = resolveToCanonical(element.name)
        if (!GIT_SAFETY_WRITE_CMDLETS.has(canonical)) return false
        // Raw arg text — normalizer strips colon-bound params, quotes, ./, case.
        // PS ArrayLiteralAst (`New-Item a,hooks/pre-commit`) surfaces as a single
        // comma-joined arg — split before checking.
        if (
          element.args
            .flatMap(a => a.split(','))
            .some(a => isGitInternalPathPS(a))
        ) {
          return true
        }
        // Pipeline input: `"hooks/pre-commit" | New-Item -ItemType File` binds the
        // string to -Path at runtime. The path is in a non-CommandAst pipeline
        // element, not in element.args. The hasExpressionSource guard at step 5
        // already forces approval here; this check just adds the git-internal
        // warning text.
        if (statement !== null) {
          for (const c of statement.commands) {
            if (c.elementType === 'CommandAst') continue
            if (isGitInternalPathPS(c.text)) return true
          }
        }
        return false
      },
    )
    // Also check top-level file redirections (> hooks/pre-commit)
    const redirWritesToGitInternal = getFileRedirections(parsed).some(r =>
      isGitInternalPathPS(r.target),
    )
    if (writesToGitInternal || redirWritesToGitInternal) {
      decisions.push({
        behavior: 'ask',
        message:
          'Command writes to a git-internal path (HEAD, objects/, refs/, hooks/, .git/) and runs git. This could plant a malicious hook that git then executes.',
      })
    }
    // SECURITY: Archive-extraction TOCTOU. isCurrentDirectoryBareGitRepo
    // checks at permission-eval time; `tar -xf x.tar; git status` extracts
    // bare-repo indicators AFTER the check, BEFORE git runs. Unlike write
    // cmdlets (where we inspect args for git-internal paths), archive
    // contents are opaque — any extraction in a compound with git must ask.
    const hasArchiveExtractor = allSubCommands.some(({ element }) =>
      GIT_SAFETY_ARCHIVE_EXTRACTORS.has(element.name.toLowerCase()),
    )
    if (hasArchiveExtractor) {
      decisions.push({
        behavior: 'ask',
        message:
          'Compound command extracts an archive and runs git. Archive contents may plant bare-repository indicators (HEAD, hooks/, refs/) that git then treats as the repository root.',
      })
    }
  }

  // .git/ writes are dangerous even WITHOUT a git subcommand — a planted
  // .git/hooks/pre-commit fires on the user's next commit. Unlike the
  // bare-repo check above (which gates on hasGitSubCommand because `hooks/`
  // is a common project dirname), `.git/` is unambiguous.
  {
    const found =
      allSubCommands.some(({ element }) => {
        for (const r of element.redirections ?? []) {
          if (isDotGitPathPS(r.target)) return true
        }
        const canonical = resolveToCanonical(element.name)
        if (!GIT_SAFETY_WRITE_CMDLETS.has(canonical)) return false
        return element.args.flatMap(a => a.split(',')).some(isDotGitPathPS)
      }) || getFileRedirections(parsed).some(r => isDotGitPathPS(r.target))
    if (found) {
      decisions.push({
        behavior: 'ask',
        message:
          'Command writes to .git/ — hooks or config planted there execute on the next git operation.',
      })
    }
  }

  // Decision: path constraints — was step 4.44 (:835-845).
  // The deny-capable check that was being masked by earlier asks. Returns
  // 'deny' when an Edit(...) deny rule matches an extracted path (pathValidation
  // lines ~994, 1088, 1160, 1210), 'ask' for paths outside working dirs, or
  // 'passthrough'.
  //
  // Thread hasCdSubCommand (BashTool compoundCommandHasCd parity): when the
  // compound contains a cwd-changing cmdlet, checkPathConstraints forces 'ask'
  // for any statement with path operations — relative paths resolve against the
  // stale validator cwd, not PowerShell's runtime cwd. This is the architectural
  // fix for the CWD-desync cluster (findings #3/#21/#27/#28), replacing the
  // per-auto-allow-site guards with a single gate at the path-resolution layer.
  const pathResult = checkPathConstraints(
    input,
    parsed,
    toolPermissionContext,
    hasCdSubCommand,
  )
  if (pathResult.behavior !== 'passthrough') {
    decisions.push(pathResult)
  }

  // Decision: exact allow (parse-succeeded case) — was step 4.45 (:861-867).
  // Matches BashTool ordering: sub-command deny → path constraints → exact
  // allow. Reduce enforces deny > ask > allow, so the exact allow only
  // surfaces when no deny or ask fired — same as sequential.
  //
  // SECURITY: nameType gate — mirrors the parse-failed guard at L696-700.
  // Input-side stripModulePrefix is unconditional: `scripts\Get-Content`
  // strips to `Get-Content`, canonicalCommand matches exact allow. Without
  // this gate, allow enters decisions[] and reduce returns it before step 5
  // can inspect nameType — PowerShell runs the local .ps1 file. The AST's
  // nameType for the first command element is authoritative when parse
  // succeeded; 'application' means a script/executable path, not a cmdlet.
  // SECURITY: Same argLeaksValue gate as the per-subcommand loop below
  // (finding #32). Without it, `PowerShell(Write-Output:*)` exact-matches
  // `Write-Output $env:ANTHROPIC_API_KEY`, pushes allow to decisions[], and
  // reduce returns it before the per-subcommand gate ever runs. The
  // allSubCommands.every check ensures NO command in the statement leaks
  // (a single-command exact-allow has one element; a pipeline has several).
  //
  // SECURITY: nameType gate must check ALL subcommands, not just [0]
  // (finding #10). canonicalCommand at L171 collapses `\n` → space, so
  // `code\n.\build.ps1` (two statements) matches exact rule
  // `PowerShell(code .\build.ps1)`. Checking only allSubCommands[0] lets the
  // second statement (nameType=application, a script path) through. Require
  // EVERY subcommand to have nameType !== 'application'.
  if (
    exactMatchResult.behavior === 'allow' &&
    allSubCommands[0] !== undefined &&
    allSubCommands.every(
      sc =>
        sc.element.nameType !== 'application' &&
        !argLeaksValue(sc.text, sc.element),
    )
  ) {
    decisions.push(exactMatchResult)
  }

  // Decision: read-only allowlist — was step 4.5 (:869-885).
  // Mirrors Bash auto-allow for ls, cat, git status, etc. PowerShell
  // equivalents: Get-Process, Get-ChildItem, Get-Content, git log, etc.
  // Reduce places this below sub-command ask rules (ask > allow).
  if (isReadOnlyCommand(command, parsed)) {
    decisions.push({
      behavior: 'allow',
      updatedInput: input,
      decisionReason: {
        type: 'other',
        reason: 'Command is read-only and safe to execute',
      },
    })
  }

  // Decision: file redirections — was :887-900.
  // Redirections (>, >>, 2>) write to arbitrary paths. isReadOnlyCommand
  // already rejects redirections internally so this can't conflict with the
  // read-only allow above. Reduce places it above checkPermissionMode allow.
  const fileRedirections = getFileRedirections(parsed)
  if (fileRedirections.length > 0) {
    decisions.push({
      behavior: 'ask',
      message:
        'Command contains file redirections that could write to arbitrary paths',
      suggestions: suggestionForExactCommand(command),
    })
  }

  // Decision: mode-specific handling (acceptEdits) — was step 4.7 (:902-906).
  // checkPermissionMode only returns 'allow' | 'passthrough'.
  const modeResult = checkPermissionMode(input, parsed, toolPermissionContext)
  if (modeResult.behavior !== 'passthrough') {
    decisions.push(modeResult)
  }

  // REDUCE: deny > ask > allow > passthrough. First of each behavior type
  // wins (preserves step-order messaging for single-check cases). If nothing
  // decided, fall through to step 5 per-sub-command approval collection.
  const deniedDecision = decisions.find(d => d.behavior === 'deny')
  if (deniedDecision !== undefined) {
    return deniedDecision
  }
  const askDecision = decisions.find(d => d.behavior === 'ask')
  if (askDecision !== undefined) {
    return askDecision
  }
  const allowDecision = decisions.find(d => d.behavior === 'allow')
  if (allowDecision !== undefined) {
    return allowDecision
  }

  // 5. Pipeline/statement splitting: check each sub-command independently.
  // This prevents a prefix rule like "Get-Process:*" from silently allowing
  // piped commands like "Get-Process | Stop-Process -Force".
  // Note: deny rules are already checked above (4.4), so this loop handles
  // ask rules, explicit allow rules, and read-only allowlist fallback.

  // Filter out safe output cmdlets (Format-Table, etc.) — they were checked
  // for deny rules in step 4.4 but shouldn't need independent approval here.
  // Also filter out cd/Set-Location to CWD (model habit, Bash parity).
  const subCommands = allSubCommands.filter(({ element, isSafeOutput }) => {
    if (isSafeOutput) {
      return false
    }
    // SECURITY: nameType gate — sixth location. Filtering out of the approval
    // list is a form of auto-allow. scripts\\Set-Location . would match below
    // (stripped name 'Set-Location', arg '.' → CWD) and be silently dropped,
    // then scripts\\Set-Location.ps1 executes with no prompt. Keep 'application'
    // commands in the list so they reach isAllowlistedCommand (which rejects them).
    if (element.nameType === 'application') {
      return true
    }
    const canonical = resolveToCanonical(element.name)
    if (canonical === 'set-location' && element.args.length > 0) {
      // SECURITY: use PS_TOKENIZER_DASH_CHARS, not ASCII-only startsWith('-').
      // `Set-Location –Path .` (en-dash) would otherwise treat `–Path` as the
      // target, resolve it against cwd (mismatch), and keep the command in the
      // approval list — correct. But `Set-Location –LiteralPath evil` with
      // en-dash would find `–LiteralPath` as "target", mismatch cwd, stay in
      // list — also correct. The risk is the inverse: a Unicode-dash parameter
      // being treated as the positional target. Use the tokenizer dash set.
      const target = element.args.find(
        a => a.length === 0 || !PS_TOKENIZER_DASH_CHARS.has(a[0]!),
      )
      if (target && resolve(getCwd(), target) === getCwd()) {
        return false
      }
    }
    return true
  })

  // Note: cd+git compound guard already ran at step 4.42. If we reach here,
  // either there's no cd or no git in the compound.

  const subCommandsNeedingApproval: string[] = []
  // Statements whose sub-commands were PUSHED to subCommandsNeedingApproval
  // in the step-5 loop below. The fail-closed gate (after the loop) only
  // pushes statements NOT tracked here — prevents duplicate suggestions where
  // both "Get-Process" (sub-command) AND "$x = Get-Process" (full statement)
  // appear.
  //
  // SECURITY: track on PUSH only, not on loop entry.
  // If a statement's only sub-commands `continue` via user allow rules
  // (L1113), marking it seen at loop-entry would make the fail-closed gate
  // skip it — auto-allowing invisible non-CommandAst content like bare
  // `$env:SECRET` inside control flow. Example attack: user approves
  // Get-Process, then `if ($true) { Get-Process; $env:SECRET }` — Get-Process
  // is allow-ruled (continue, no push), $env:SECRET is VariableExpressionAst
  // (not a sub-command), statement marked seen → gate skips → auto-allow →
  // secret leaks. Tracking on push only: statement stays unseen → gate fires
  // → ask.
  const statementsSeenInLoop = new Set<
    ParsedPowerShellCommand['statements'][number]
  >()

  for (const { text: subCmd, element, statement } of subCommands) {
    // Check deny rules FIRST - user explicit rules take precedence over allowlist
    const subInput = { command: subCmd }
    const subResult = powershellToolCheckPermission(
      subInput,
      toolPermissionContext,
    )

    if (subResult.behavior === 'deny') {
      return {
        behavior: 'deny',
        message: `Permission to use ${POWERSHELL_TOOL_NAME} with command ${command} has been denied.`,
        decisionReason: subResult.decisionReason,
      }
    }

    if (subResult.behavior === 'ask') {
      if (statement !== null) {
        statementsSeenInLoop.add(statement)
      }
      subCommandsNeedingApproval.push(subCmd)
      continue
    }

    // Explicitly allowed by a user rule — BUT NOT for applications/scripts.
    // SECURITY: INPUT-side stripModulePrefix is unconditional, so
    // `scripts\Get-Content /etc/shadow` strips to 'Get-Content' and matches
    // an allow rule `Get-Content:*`. Without the nameType guard, continue
    // skips all checks and the local script runs. nameType is classified from
    // the RAW name pre-strip — `scripts\Get-Content` → 'application' (has `\`).
    // Module-qualified cmdlets also classify 'application' — fail-safe over-fire.
    // An application should NEVER be auto-allowed by a cmdlet allow rule.
    if (
      subResult.behavior === 'allow' &&
      element.nameType !== 'application' &&
      !hasSymlinkCreate
    ) {
      // SECURITY: User allow rule asserts the cmdlet is safe, NOT that
      // arbitrary variable expansion through it is safe. A user who allows
      // PowerShell(Write-Output:*) did not intend to auto-allow
      // `Write-Output $env:ANTHROPIC_API_KEY`. Apply the same argLeaksValue
      // gate that protects the built-in allowlist path below — rejects
      // Variable/Other/ScriptBlock/SubExpression elementTypes and colon-bound
      // expression children. (security finding #32)
      //
      // SECURITY: Also skip when the compound contains a symlink-creating
      // command (finding — symlink+read gap). New-Item -ItemType SymbolicLink
      // can redirect subsequent reads to arbitrary paths. The built-in
      // allowlist path (below) and acceptEdits path both gate on
      // !hasSymlinkCreate; the user-rule path must too.
      if (argLeaksValue(subCmd, element)) {
        if (statement !== null) {
          statementsSeenInLoop.add(statement)
        }
        subCommandsNeedingApproval.push(subCmd)
        continue
      }
      continue
    }
    if (subResult.behavior === 'allow') {
      // nameType === 'application' with a matching allow rule: the rule was
      // written for a cmdlet, but this is a script/executable masquerading.
      // Don't continue; fall through to approval (NOT deny — the user may
      // actually want to run `scripts\Get-Content` and will see a prompt).
      if (statement !== null) {
        statementsSeenInLoop.add(statement)
      }
      subCommandsNeedingApproval.push(subCmd)
      continue
    }

    // SECURITY: fail-closed gate. Do NOT take the allowlist shortcut unless
    // the parent statement is a PipelineAst where every element is a
    // CommandAst. This subsumes the previous hasExpressionSource check
    // (expression sources are one way a statement fails the gate) and also
    // rejects assignments, chain operators, control flow, and any future
    // AST type by construction. Examples this blocks:
    //   'env:SECRET_API_KEY' | Get-Content  — CommandExpressionAst element
    //   $x = Get-Process                   — AssignmentStatementAst
    //   Get-Process && Get-Service         — PipelineChainAst
    // Explicit user allow rules (above) run before this gate but apply their
    // own argLeaksValue check; both paths now gate argument elementTypes.
    //
    // SECURITY: Also skip when the compound contains a cwd-changing cmdlet
    // (finding #27 — cd+read gap). isAllowlistedCommand validates Get-Content
    // in isolation, but `Set-Location ~; Get-Content ./.ssh/id_rsa` runs
    // Get-Content from ~, not from the validator's cwd. Path validation saw
    // /project/.ssh/id_rsa; runtime reads ~/.ssh/id_rsa. Same gate as the
    // checkPermissionMode call below and the checkPathConstraints threading.
    if (
      statement !== null &&
      !hasCdSubCommand &&
      !hasSymlinkCreate &&
      isProvablySafeStatement(statement) &&
      isAllowlistedCommand(element, subCmd)
    ) {
      continue
    }

    // Check per-sub-command acceptEdits mode (BashTool parity).
    // Delegate to checkPermissionMode on a single-statement AST so that ALL
    // of its guards apply: expression pipeline sources (non-CommandAst elements),
    // security flags (subexpressions, script blocks, assignments, splatting, etc.),
    // and the ACCEPT_EDITS_ALLOWED_CMDLETS allowlist. This keeps one source of
    // truth for what makes a statement safe in acceptEdits mode — any future
    // hardening of checkPermissionMode automatically applies here.
    //
    // Pass parsed.variables (not []) so splatting from any statement in the
    // compound command is visible. Conservative: if we can't tell which statement
    // a splatted variable affects, assume it affects all of them.
    //
    // SECURITY: Skip this auto-allow path when the compound contains a
    // cwd-changing command (Set-Location/Push-Location/Pop-Location). The
    // synthetic single-statement AST strips compound context, so
    // checkPermissionMode cannot see the cd in other statements. Without this
    // gate, `Set-Location ./.claude; Set-Content ./settings.json '...'` would
    // pass: Set-Content is checked in isolation, matches ACCEPT_EDITS_ALLOWED_CMDLETS,
    // and auto-allows — but PowerShell runs it from the changed cwd, writing to
    // .claude/settings.json (a Claude config file the path validator didn't check).
    // This matches BashTool's compoundCommandHasCd guard.
    if (statement !== null && !hasCdSubCommand && !hasSymlinkCreate) {
      const subModeResult = checkPermissionMode(
        { command: subCmd },
        {
          valid: true,
          errors: [],
          variables: parsed.variables,
          hasStopParsing: parsed.hasStopParsing,
          originalCommand: subCmd,
          statements: [statement],
        },
        toolPermissionContext,
      )
      if (subModeResult.behavior === 'allow') {
        continue
      }
    }

    // Not allowlisted, no mode auto-allow, and no explicit rule — needs approval
    if (statement !== null) {
      statementsSeenInLoop.add(statement)
    }
    subCommandsNeedingApproval.push(subCmd)
  }

  // SECURITY: fail-closed gate (second half). The step-5 loop above only
  // iterates sub-commands that getSubCommandsForPermissionCheck surfaced
  // AND survived the safe-output filter. Statements that produce zero
  // CommandAst sub-commands (bare $env:SECRET) or whose only sub-commands
  // were filtered as safe-output ($env:X | Out-String) never enter the loop.
  // Without this, they silently auto-allow on empty subCommandsNeedingApproval.
  //
  // Only push statements NOT tracked above: if the loop PUSHED any
  // sub-command from a statement, the user will see a prompt. Pushing the
  // statement text too creates a duplicate suggestion where accepting the
  // sub-command rule does not prevent re-prompting.
  // If all sub-commands `continue`d (allow-ruled / allowlisted / mode-allowed)
  // the statement is NOT tracked and the gate re-checks it below — this is
  // the fail-closed property.
  for (const stmt of parsed.statements) {
    if (!isProvablySafeStatement(stmt) && !statementsSeenInLoop.has(stmt)) {
      subCommandsNeedingApproval.push(stmt.text)
    }
  }

  if (subCommandsNeedingApproval.length === 0) {
    // SECURITY: empty-list auto-allow is only safe when there's nothing
    // unverifiable. If the pipeline has script blocks, every safe-output
    // cmdlet was filtered at :1032, but the block content wasn't verified —
    // non-command AST nodes (AssignmentStatementAst etc.) are invisible to
    // getAllCommands. `Where-Object {$true} | Sort-Object {$env:PATH='evil'}`
    // would auto-allow here. hasAssignments is top-level-only (parser.ts:1385)
    // so it doesn't catch nested assignments either. Prompt instead.
    if (deriveSecurityFlags(parsed).hasScriptBlocks) {
      return {
        behavior: 'ask',
        message: createPermissionRequestMessage(POWERSHELL_TOOL_NAME),
        decisionReason: {
          type: 'other',
          reason:
            'Pipeline consists of output-formatting cmdlets with script blocks — block content cannot be verified',
        },
      }
    }
    return {
      behavior: 'allow',
      updatedInput: input,
      decisionReason: {
        type: 'other',
        reason: 'All pipeline commands are individually allowed',
      },
    }
  }

  // 6. Some sub-commands need approval — build suggestions
  const decisionReason = {
    type: 'other' as const,
    reason: 'This command requires approval',
  }

  const pendingSuggestions: PermissionUpdate[] = []
  for (const subCmd of subCommandsNeedingApproval) {
    pendingSuggestions.push(...suggestionForExactCommand(subCmd))
  }

  return {
    behavior: 'passthrough',
    message: createPermissionRequestMessage(
      POWERSHELL_TOOL_NAME,
      decisionReason,
    ),
    decisionReason,
    suggestions: pendingSuggestions,
  }
}
