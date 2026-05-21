import { z } from 'zod/v4'
import { mcpInfoFromString } from '../../services/mcp/mcpStringUtils.js'
import { lazySchema } from '../lazySchema.js'
import { permissionRuleValueFromString } from '../permissions/permissionRuleParser.js'
import { capitalize } from '../stringUtils.js'
import {
  getCustomValidation,
  isBashPrefixTool,
  isFilePatternTool,
} from './toolValidationConfig.js'

/**
 * Checks if a character at a given index is escaped (preceded by odd number of backslashes).
 */
function isEscaped(str: string, index: number): boolean {
  let backslashCount = 0
  let j = index - 1
  while (j >= 0 && str[j] === '\\') {
    backslashCount++
    j--
  }
  return backslashCount % 2 !== 0
}

/**
 * Counts unescaped occurrences of a character in a string.
 * A character is considered escaped if preceded by an odd number of backslashes.
 */
function countUnescapedChar(str: string, char: string): number {
  let count = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char && !isEscaped(str, i)) {
      count++
    }
  }
  return count
}

/**
 * Checks if a string contains unescaped empty parentheses "()".
 * Returns true only if both the "(" and ")" are unescaped and adjacent.
 */
function hasUnescapedEmptyParens(str: string): boolean {
  for (let i = 0; i < str.length - 1; i++) {
    if (str[i] === '(' && str[i + 1] === ')') {
      // Check if the opening paren is unescaped
      if (!isEscaped(str, i)) {
        return true
      }
    }
  }
  return false
}

/**
 * Validates permission rule format and content
 */
export function validatePermissionRule(rule: string): {
  valid: boolean
  error?: string
  suggestion?: string
  examples?: string[]
} {
  // Empty rule check
  if (!rule || rule.trim() === '') {
    return { valid: false, error: 'Permission rule cannot be empty' }
  }

  // Check parentheses matching first (only count unescaped parens)
  const openCount = countUnescapedChar(rule, '(')
  const closeCount = countUnescapedChar(rule, ')')
  if (openCount !== closeCount) {
    return {
      valid: false,
      error: 'Mismatched parentheses',
      suggestion:
        'Ensure all opening parentheses have matching closing parentheses',
    }
  }

  // Check for empty parentheses (escape-aware)
  if (hasUnescapedEmptyParens(rule)) {
    const toolName = rule.substring(0, rule.indexOf('('))
    if (!toolName) {
      return {
        valid: false,
        error: 'Empty parentheses with no tool name',
        suggestion: 'Specify a tool name before the parentheses',
      }
    }
    return {
      valid: false,
      error: 'Empty parentheses',
      suggestion: `Either specify a pattern or use just "${toolName}" without parentheses`,
      examples: [`${toolName}`, `${toolName}(some-pattern)`],
    }
  }

  // Parse the rule
  const parsed = permissionRuleValueFromString(rule)

  // MCP validation - must be done before general tool validation
  const mcpInfo = mcpInfoFromString(parsed.toolName)
  if (mcpInfo) {
    // MCP rules support server-level, tool-level, and wildcard permissions
    // Valid formats:
    // - mcp__server (server-level, all tools)
    // - mcp__server__* (wildcard, all tools - equivalent to server-level)
    // - mcp__server__tool (specific tool)

    // MCP rules cannot have any pattern/content (parentheses)
    // Check both parsed content and raw string since the parser normalizes
    // standalone wildcards (e.g., "mcp__server(*)") to undefined ruleContent
    if (parsed.ruleContent !== undefined || countUnescapedChar(rule, '(') > 0) {
      return {
        valid: false,
        error: 'MCP rules do not support patterns in parentheses',
        suggestion: `Use "${parsed.toolName}" without parentheses, or use "mcp__${mcpInfo.serverName}__*" for all tools`,
        examples: [
          `mcp__${mcpInfo.serverName}`,
          `mcp__${mcpInfo.serverName}__*`,
          mcpInfo.toolName && mcpInfo.toolName !== '*'
            ? `mcp__${mcpInfo.serverName}__${mcpInfo.toolName}`
            : undefined,
        ].filter(Boolean) as string[],
      }
    }

    return { valid: true } // Valid MCP rule
  }

  // Tool name validation (for non-MCP tools)
  if (!parsed.toolName || parsed.toolName.length === 0) {
    return { valid: false, error: 'Tool name cannot be empty' }
  }

  // Check tool name starts with uppercase (standard tools)
  if (parsed.toolName[0] !== parsed.toolName[0]?.toUpperCase()) {
    return {
      valid: false,
      error: 'Tool names must start with uppercase',
      suggestion: `Use "${capitalize(String(parsed.toolName))}"`,
    }
  }

  // Check for custom validation rules first
  const customValidation = getCustomValidation(parsed.toolName)
  if (customValidation && parsed.ruleContent !== undefined) {
    const customResult = customValidation(parsed.ruleContent)
    if (!customResult.valid) {
      return customResult
    }
  }

  // Bash-specific validation
  if (isBashPrefixTool(parsed.toolName) && parsed.ruleContent !== undefined) {
    const content = parsed.ruleContent

    // Check for common :* mistakes - :* must be at the end (legacy prefix syntax)
    if (content.includes(':*') && !content.endsWith(':*')) {
      return {
        valid: false,
        error: 'The :* pattern must be at the end',
        suggestion:
          'Move :* to the end for prefix matching, or use * for wildcard matching',
        examples: [
          'Bash(npm run:*) - prefix matching (legacy)',
          'Bash(npm run *) - wildcard matching',
        ],
      }
    }

    // Check for :* without a prefix
    if (content === ':*') {
      return {
        valid: false,
        error: 'Prefix cannot be empty before :*',
        suggestion: 'Specify a command prefix before :*',
        examples: ['Bash(npm:*)', 'Bash(git:*)'],
      }
    }

    // Note: We don't validate quote balancing because bash quoting rules are complex.
    // A command like `grep '"'` has valid unbalanced double quotes.
    // Users who create patterns with unintended quote mismatches will discover
    // the issue when matching doesn't work as expected.

    // Wildcards are now allowed at any position for flexible pattern matching
    // Examples of valid wildcard patterns:
    // - "npm *" matches "npm install", "npm run test", etc.
    // - "* install" matches "npm install", "yarn install", etc.
    // - "git * main" matches "git checkout main", "git push main", etc.
    // - "npm * --save" matches "npm install foo --save", etc.
    //
    // Legacy :* syntax continues to work for backwards compatibility:
    // - "npm:*" matches "npm" or "npm <anything>" (prefix matching with word boundary)
  }

  // File tool validation
  if (isFilePatternTool(parsed.toolName) && parsed.ruleContent !== undefined) {
    const content = parsed.ruleContent

    // Check for :* in file patterns (common mistake from Bash patterns)
    if (content.includes(':*')) {
      return {
        valid: false,
        error: 'The ":*" syntax is only for Bash prefix rules',
        suggestion: 'Use glob patterns like "*" or "**" for file matching',
        examples: [
          `${parsed.toolName}(*.ts) - matches .ts files`,
          `${parsed.toolName}(src/**) - matches all files in src`,
          `${parsed.toolName}(**/*.test.ts) - matches test files`,
        ],
      }
    }

    // Warn about wildcards not at boundaries
    if (
      content.includes('*') &&
      !content.match(/^\*|\*$|\*\*|\/\*|\*\.|\*\)/) &&
      !content.includes('**')
    ) {
      // This is a loose check - wildcards in the middle might be valid in some cases
      // but often indicate confusion
      return {
        valid: false,
        error: 'Wildcard placement might be incorrect',
        suggestion: 'Wildcards are typically used at path boundaries',
        examples: [
          `${parsed.toolName}(*.js) - all .js files`,
          `${parsed.toolName}(src/*) - all files directly in src`,
          `${parsed.toolName}(src/**) - all files recursively in src`,
        ],
      }
    }
  }

  return { valid: true }
}

/**
 * Custom Zod schema for permission rule arrays
 */
export const PermissionRuleSchema = lazySchema(() =>
  z.string().superRefine((val, ctx) => {
    const result = validatePermissionRule(val)
    if (!result.valid) {
      let message = result.error!
      if (result.suggestion) {
        message += `. ${result.suggestion}`
      }
      if (result.examples && result.examples.length > 0) {
        message += `. Examples: ${result.examples.join(', ')}`
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        params: { received: val },
      })
    }
  }),
)
