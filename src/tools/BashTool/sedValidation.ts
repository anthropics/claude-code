import type { ToolPermissionContext } from '../../Tool.js'
import { splitCommand_DEPRECATED } from '../../utils/bash/commands.js'
import { tryParseShellCommand } from '../../utils/bash/shellQuote.js'
import type { PermissionResult } from '../../utils/permissions/PermissionResult.js'

/**
 * Helper: Validate flags against an allowlist
 * Handles both single flags and combined flags (e.g., -nE)
 * @param flags Array of flags to validate
 * @param allowedFlags Array of allowed single-character and long flags
 * @returns true if all flags are valid, false otherwise
 */
function validateFlagsAgainstAllowlist(
  flags: string[],
  allowedFlags: string[],
): boolean {
  for (const flag of flags) {
    // Handle combined flags like -nE or -Er
    if (flag.startsWith('-') && !flag.startsWith('--') && flag.length > 2) {
      // Check each character in combined flag
      for (let i = 1; i < flag.length; i++) {
        const singleFlag = '-' + flag[i]
        if (!allowedFlags.includes(singleFlag)) {
          return false
        }
      }
    } else {
      // Single flag or long flag
      if (!allowedFlags.includes(flag)) {
        return false
      }
    }
  }
  return true
}

/**
 * Pattern 1: Check if this is a line printing command with -n flag
 * Allows: sed -n 'N' | sed -n 'N,M' with optional -E, -r, -z flags
 * Allows semicolon-separated print commands like: sed -n '1p;2p;3p'
 * File arguments are ALLOWED for this pattern
 * @internal Exported for testing
 */
export function isLinePrintingCommand(
  command: string,
  expressions: string[],
): boolean {
  const sedMatch = command.match(/^\s*sed\s+/)
  if (!sedMatch) return false

  const withoutSed = command.slice(sedMatch[0].length)
  const parseResult = tryParseShellCommand(withoutSed)
  if (!parseResult.success) return false
  const parsed = parseResult.tokens

  // Extract all flags
  const flags: string[] = []
  for (const arg of parsed) {
    if (typeof arg === 'string' && arg.startsWith('-') && arg !== '--') {
      flags.push(arg)
    }
  }

  // Validate flags - only allow -n, -E, -r, -z and their long forms
  const allowedFlags = [
    '-n',
    '--quiet',
    '--silent',
    '-E',
    '--regexp-extended',
    '-r',
    '-z',
    '--zero-terminated',
    '--posix',
  ]

  if (!validateFlagsAgainstAllowlist(flags, allowedFlags)) {
    return false
  }

  // Check if -n flag is present (required for Pattern 1)
  let hasNFlag = false
  for (const flag of flags) {
    if (flag === '-n' || flag === '--quiet' || flag === '--silent') {
      hasNFlag = true
      break
    }
    // Check in combined flags
    if (flag.startsWith('-') && !flag.startsWith('--') && flag.includes('n')) {
      hasNFlag = true
      break
    }
  }

  // Must have -n flag for Pattern 1
  if (!hasNFlag) {
    return false
  }

  // Must have at least one expression
  if (expressions.length === 0) {
    return false
  }

  // All expressions must be print commands (strict allowlist)
  // Allow semicolon-separated commands
  for (const expr of expressions) {
    const commands = expr.split(';')
    for (const cmd of commands) {
      if (!isPrintCommand(cmd.trim())) {
        return false
      }
    }
  }

  return true
}

/**
 * Helper: Check if a single command is a valid print command
 * STRICT ALLOWLIST - only these exact forms are allowed:
 * - p (print all)
 * - Np (print line N, where N is digits)
 * - N,Mp (print lines N through M)
 * Anything else (including w, W, e, E commands) is rejected.
 * @internal Exported for testing
 */
export function isPrintCommand(cmd: string): boolean {
  if (!cmd) return false
  // Single strict regex that only matches allowed print commands
  // ^(?:\d+|\d+,\d+)?p$ matches: p, 1p, 123p, 1,5p, 10,200p
  return /^(?:\d+|\d+,\d+)?p$/.test(cmd)
}

/**
 * Pattern 2: Check if this is a substitution command
 * Allows: sed 's/pattern/replacement/flags' where flags are only: g, p, i, I, m, M, 1-9
 * When allowFileWrites is true, allows -i flag and file arguments for in-place editing
 * When allowFileWrites is false (default), requires stdout-only (no file arguments, no -i flag)
 * @internal Exported for testing
 */
function isSubstitutionCommand(
  command: string,
  expressions: string[],
  hasFileArguments: boolean,
  options?: { allowFileWrites?: boolean },
): boolean {
  const allowFileWrites = options?.allowFileWrites ?? false

  // When not allowing file writes, must NOT have file arguments
  if (!allowFileWrites && hasFileArguments) {
    return false
  }

  const sedMatch = command.match(/^\s*sed\s+/)
  if (!sedMatch) return false

  const withoutSed = command.slice(sedMatch[0].length)
  const parseResult = tryParseShellCommand(withoutSed)
  if (!parseResult.success) return false
  const parsed = parseResult.tokens

  // Extract all flags
  const flags: string[] = []
  for (const arg of parsed) {
    if (typeof arg === 'string' && arg.startsWith('-') && arg !== '--') {
      flags.push(arg)
    }
  }

  // Validate flags based on mode
  // Base allowed flags for both modes
  const allowedFlags = ['-E', '--regexp-extended', '-r', '--posix']

  // When allowing file writes, also permit -i and --in-place
  if (allowFileWrites) {
    allowedFlags.push('-i', '--in-place')
  }

  if (!validateFlagsAgainstAllowlist(flags, allowedFlags)) {
    return false
  }

  // Must have exactly one expression
  if (expressions.length !== 1) {
    return false
  }

  const expr = expressions[0]!.trim()

  // STRICT ALLOWLIST: Must be exactly a substitution command starting with 's'
  // This rejects standalone commands like 'e', 'w file', etc.
  if (!expr.startsWith('s')) {
    return false
  }

  // Parse substitution: s/pattern/replacement/flags
  // Only allow / as delimiter (strict)
  const substitutionMatch = expr.match(/^s\/(.*?)$/)
  if (!substitutionMatch) {
    return false
  }

  const rest = substitutionMatch[1]!

  // Find the positions of / delimiters
  let delimiterCount = 0
  let lastDelimiterPos = -1
  let i = 0
  while (i < rest.length) {
    if (rest[i] === '\\') {
      // Skip escaped character
      i += 2
      continue
    }
    if (rest[i] === '/') {
      delimiterCount++
      lastDelimiterPos = i
    }
    i++
  }

  // Must have found exactly 2 delimiters (pattern and replacement)
  if (delimiterCount !== 2) {
    return false
  }

  // Extract flags (everything after the last delimiter)
  const exprFlags = rest.slice(lastDelimiterPos + 1)

  // Validate flags: only allow g, p, i, I, m, M, and optionally ONE digit 1-9
  const allowedFlagChars = /^[gpimIM]*[1-9]?[gpimIM]*$/
  if (!allowedFlagChars.test(exprFlags)) {
    return false
  }

  return true
}

/**
 * Checks if a sed command is allowed by the allowlist.
 * The allowlist patterns themselves are strict enough to reject dangerous operations.
 * @param command The sed command to check
 * @param options.allowFileWrites When true, allows -i flag and file arguments for substitution commands
 * @returns true if the command is allowed (matches allowlist and passes denylist check), false otherwise
 */
export function sedCommandIsAllowedByAllowlist(
  command: string,
  options?: { allowFileWrites?: boolean },
): boolean {
  const allowFileWrites = options?.allowFileWrites ?? false

  // Extract sed expressions (content inside quotes where actual sed commands live)
  let expressions: string[]
  try {
    expressions = extractSedExpressions(command)
  } catch (_error) {
    // If parsing failed, treat as not allowed
    return false
  }

  // Check if sed command has file arguments
  const hasFileArguments = hasFileArgs(command)

  // Check if command matches allowlist patterns
  let isPattern1 = false
  let isPattern2 = false

  if (allowFileWrites) {
    // When allowing file writes, only check substitution commands (Pattern 2 variant)
    // Pattern 1 (line printing) doesn't need file writes
    isPattern2 = isSubstitutionCommand(command, expressions, hasFileArguments, {
      allowFileWrites: true,
    })
  } else {
    // Standard read-only mode: check both patterns
    isPattern1 = isLinePrintingCommand(command, expressions)
    isPattern2 = isSubstitutionCommand(command, expressions, hasFileArguments)
  }

  if (!isPattern1 && !isPattern2) {
    return false
  }

  // Pattern 2 does not allow semicolons (command separators)
  // Pattern 1 allows semicolons for separating print commands
  for (const expr of expressions) {
    if (isPattern2 && expr.includes(';')) {
      return false
    }
  }

  // Defense-in-depth: Even if allowlist matches, check denylist
  for (const expr of expressions) {
    if (containsDangerousOperations(expr)) {
      return false
    }
  }

  return true
}

/**
 * Check if a sed command has file arguments (not just stdin)
 * @internal Exported for testing
 */
export function hasFileArgs(command: string): boolean {
  const sedMatch = command.match(/^\s*sed\s+/)
  if (!sedMatch) return false

  const withoutSed = command.slice(sedMatch[0].length)
  const parseResult = tryParseShellCommand(withoutSed)
  if (!parseResult.success) return true
  const parsed = parseResult.tokens

  try {
    let argCount = 0
    let hasEFlag = false

    for (let i = 0; i < parsed.length; i++) {
      const arg = parsed[i]

      // Handle both string arguments and glob patterns (like *.log)
      if (typeof arg !== 'string' && typeof arg !== 'object') continue

      // If it's a glob pattern, it counts as a file argument
      if (
        typeof arg === 'object' &&
        arg !== null &&
        'op' in arg &&
        arg.op === 'glob'
      ) {
        return true
      }

      // Skip non-string arguments that aren't glob patterns
      if (typeof arg !== 'string') continue

      // Handle -e flag followed by expression
      if ((arg === '-e' || arg === '--expression') && i + 1 < parsed.length) {
        hasEFlag = true
        i++ // Skip the next argument since it's the expression
        continue
      }

      // Handle --expression=value format
      if (arg.startsWith('--expression=')) {
        hasEFlag = true
        continue
      }

      // Handle -e=value format (non-standard but defense in depth)
      if (arg.startsWith('-e=')) {
        hasEFlag = true
        continue
      }

      // Skip other flags
      if (arg.startsWith('-')) continue

      argCount++

      // If we used -e flags, ALL non-flag arguments are file arguments
      if (hasEFlag) {
        return true
      }

      // If we didn't use -e flags, the first non-flag argument is the sed expression,
      // so we need more than 1 non-flag argument to have file arguments
      if (argCount > 1) {
        return true
      }
    }

    return false
  } catch (_error) {
    return true // Assume dangerous if parsing fails
  }
}

/**
 * Extract sed expressions from command, ignoring flags and filenames
 * @param command Full sed command
 * @returns Array of sed expressions to check for dangerous operations
 * @throws Error if parsing fails
 * @internal Exported for testing
 */
export function extractSedExpressions(command: string): string[] {
  const expressions: string[] = []

  // Calculate withoutSed by trimming off the first N characters (removing 'sed ')
  const sedMatch = command.match(/^\s*sed\s+/)
  if (!sedMatch) return expressions

  const withoutSed = command.slice(sedMatch[0].length)

  // Reject dangerous flag combinations like -ew, -eW, -ee, -we (combined -e/-w with dangerous commands)
  if (/-e[wWe]/.test(withoutSed) || /-w[eE]/.test(withoutSed)) {
    throw new Error('Dangerous flag combination detected')
  }

  // Use shell-quote to parse the arguments properly
  const parseResult = tryParseShellCommand(withoutSed)
  if (!parseResult.success) {
    // Malformed shell syntax - throw error to be caught by caller
    throw new Error(`Malformed shell syntax: ${parseResult.error}`)
  }
  const parsed = parseResult.tokens
  try {
    let foundEFlag = false
    let foundExpression = false

    for (let i = 0; i < parsed.length; i++) {
      const arg = parsed[i]

      // Skip non-string arguments (like control operators)
      if (typeof arg !== 'string') continue

      // Handle -e flag followed by expression
      if ((arg === '-e' || arg === '--expression') && i + 1 < parsed.length) {
        foundEFlag = true
        const nextArg = parsed[i + 1]
        if (typeof nextArg === 'string') {
          expressions.push(nextArg)
          i++ // Skip the next argument since we consumed it
        }
        continue
      }

      // Handle --expression=value format
      if (arg.startsWith('--expression=')) {
        foundEFlag = true
        expressions.push(arg.slice('--expression='.length))
        continue
      }

      // Handle -e=value format (non-standard but defense in depth)
      if (arg.startsWith('-e=')) {
        foundEFlag = true
        expressions.push(arg.slice('-e='.length))
        continue
      }

      // Skip other flags
      if (arg.startsWith('-')) continue

      // If we haven't found any -e flags, the first non-flag argument is the sed expression
      if (!foundEFlag && !foundExpression) {
        expressions.push(arg)
        foundExpression = true
        continue
      }

      // If we've already found -e flags or a standalone expression,
      // remaining non-flag arguments are filenames
      break
    }
  } catch (error) {
    // If shell-quote parsing fails, treat the sed command as unsafe
    throw new Error(
      `Failed to parse sed command: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }

  return expressions
}

/**
 * Check if a sed expression contains dangerous operations (denylist)
 * @param expression Single sed expression (without quotes)
 * @returns true if dangerous, false if safe
 */
function containsDangerousOperations(expression: string): boolean {
  const cmd = expression.trim()
  if (!cmd) return false

  // CONSERVATIVE REJECTIONS: Broadly reject patterns that could be dangerous
  // When in doubt, treat as unsafe

  // Reject non-ASCII characters (Unicode homoglyphs, combining chars, etc.)
  // Examples: ｗ (fullwidth), ᴡ (small capital), w̃ (combining tilde)
  // Check for characters outside ASCII range (0x01-0x7F, excluding null byte)
  // eslint-disable-next-line no-control-regex
  if (/[^\x01-\x7F]/.test(cmd)) {
    return true
  }

  // Reject curly braces (blocks) - too complex to parse
  if (cmd.includes('{') || cmd.includes('}')) {
    return true
  }

  // Reject newlines - multi-line commands are too complex
  if (cmd.includes('\n')) {
    return true
  }

  // Reject comments (# not immediately after s command)
  // Comments look like: #comment or start with #
  // Delimiter looks like: s#pattern#replacement#
  const hashIndex = cmd.indexOf('#')
  if (hashIndex !== -1 && !(hashIndex > 0 && cmd[hashIndex - 1] === 's')) {
    return true
  }

  // Reject negation operator
  // Negation can appear: at start (!/pattern/), after address (/pattern/!, 1,10!, $!)
  // Delimiter looks like: s!pattern!replacement! (has 's' before it)
  if (/^!/.test(cmd) || /[/\d$]!/.test(cmd)) {
    return true
  }

  // Reject tilde in GNU step address format (digit~digit, ,~digit, or $~digit)
  // Allow whitespace around tilde
  if (/\d\s*~\s*\d|,\s*~\s*\d|\$\s*~\s*\d/.test(cmd)) {
    return true
  }

  // Reject comma at start (bare comma is shorthand for 1,$ address range)
  if (/^,/.test(cmd)) {
    return true
  }

  // Reject comma followed by +/- (GNU offset addresses)
  if (/,\s*[+-]/.test(cmd)) {
    return true
  }

  // Reject backslash tricks:
  // 1. s\ (substitution with backslash delimiter)
  // 2. \X where X could be an alternate delimiter (|, #, %, etc.) - not regex escapes
  if (/s\\/.test(cmd) || /\\[|#%@]/.test(cmd)) {
    return true
  }

  // Reject escaped slashes followed by w/W (patterns like /\/path\/to\/file/w)
  if (/\\\/.*[wW]/.test(cmd)) {
    return true
  }

  // Reject malformed/suspicious patterns we don't understand
  // If there's a slash followed by non-slash chars, then whitespace, then dangerous commands
  // Examples: /pattern w file, /pattern e cmd, /foo X;w file
  if (/\/[^/]*\s+[wWeE]/.test(cmd)) {
    return true
  }

  // Reject malformed substitution commands that don't follow normal pattern
  // Examples: s/foobareoutput.txt (missing delimiters), s/foo/bar//w (extra delimiter)
  if (/^s\//.test(cmd) && !/^s\/[^/]*\/[^/]*\/[^/]*$/.test(cmd)) {
    return true
  }

  // PARANOID: Reject any command starting with 's' that ends with dangerous chars (w, W, e, E)
  // and doesn't match our known safe substitution pattern. This catches malformed s commands
  // with non-slash delimiters that might be trying to use dangerous flags.
  if (/^s./.test(cmd) && /[wWeE]$/.test(cmd)) {
    // Check if it's a properly formed substitution (any delimiter, not just /)
    const properSubst = /^s([^\\\n]).*?\1.*?\1[^wWeE]*$/.test(cmd)
    if (!properSubst) {
      return true
    }
  }

  // Check for dangerous write commands
  // Patterns: [address]w filename, [address]W filename, /pattern/w filename, /pattern/W filename
  // Simplified to avoid exponential backtracking (CodeQL issue)
  // Check for w/W in contexts where it would be a command (with optional whitespace)
  if (
    /^[wW]\s*\S+/.test(cmd) || // At start: w file
    /^\d+\s*[wW]\s*\S+/.test(cmd) || // After line number: 1w file or 1 w file
    /^\$\s*[wW]\s*\S+/.test(cmd) || // After $: $w file or $ w file
    /^\/[^/]*\/[IMim]*\s*[wW]\s*\S+/.test(cmd) || // After pattern: /pattern/w file
    /^\d+,\d+\s*[wW]\s*\S+/.test(cmd) || // After range: 1,10w file
    /^\d+,\$\s*[wW]\s*\S+/.test(cmd) || // After range: 1,$w file
    /^\/[^/]*\/[IMim]*,\/[^/]*\/[IMim]*\s*[wW]\s*\S+/.test(cmd) // After pattern range: /s/,/e/w file
  ) {
    return true
  }

  // Check for dangerous execute commands
  // Patterns: [address]e [command], /pattern/e [command], or commands starting with e
  // Simplified to avoid exponential backtracking (CodeQL issue)
  // Check for e in contexts where it would be a command (with optional whitespace)
  if (
    /^e/.test(cmd) || // At start: e cmd
    /^\d+\s*e/.test(cmd) || // After line number: 1e or 1 e
    /^\$\s*e/.test(cmd) || // After $: $e or $ e
    /^\/[^/]*\/[IMim]*\s*e/.test(cmd) || // After pattern: /pattern/e
    /^\d+,\d+\s*e/.test(cmd) || // After range: 1,10e
    /^\d+,\$\s*e/.test(cmd) || // After range: 1,$e
    /^\/[^/]*\/[IMim]*,\/[^/]*\/[IMim]*\s*e/.test(cmd) // After pattern range: /s/,/e/e
  ) {
    return true
  }

  // Check for substitution commands with dangerous flags
  // Pattern: s<delim>pattern<delim>replacement<delim>flags where flags contain w or e
  // Per POSIX, sed allows any character except backslash and newline as delimiter
  const substitutionMatch = cmd.match(/s([^\\\n]).*?\1.*?\1(.*?)$/)
  if (substitutionMatch) {
    const flags = substitutionMatch[2] || ''

    // Check for write flag: s/old/new/w filename or s/old/new/gw filename
    if (flags.includes('w') || flags.includes('W')) {
      return true
    }

    // Check for execute flag: s/old/new/e or s/old/new/ge
    if (flags.includes('e') || flags.includes('E')) {
      return true
    }
  }

  // Check for y (transliterate) command followed by dangerous operations
  // Pattern: y<delim>source<delim>dest<delim> followed by anything
  // The y command uses same delimiter syntax as s command
  // PARANOID: Reject any y command that has w/W/e/E anywhere after the delimiters
  const yCommandMatch = cmd.match(/y([^\\\n])/)
  if (yCommandMatch) {
    // If we see a y command, check if there's any w, W, e, or E in the entire command
    // This is paranoid but safe - y commands are rare and w/e after y is suspicious
    if (/[wWeE]/.test(cmd)) {
      return true
    }
  }

  return false
}

/**
 * Cross-cutting validation step for sed commands.
 *
 * This is a constraint check that blocks dangerous sed operations regardless of mode.
 * It returns 'passthrough' for non-sed commands or safe sed commands,
 * and 'ask' for dangerous sed operations (w/W/e/E commands).
 *
 * @param input - Object containing the command string
 * @param toolPermissionContext - Context containing mode and permissions
 * @returns
 * - 'ask' if any sed command contains dangerous operations
 * - 'passthrough' if no sed commands or all are safe
 */
export function checkSedConstraints(
  input: { command: string },
  toolPermissionContext: ToolPermissionContext,
): PermissionResult {
  const commands = splitCommand_DEPRECATED(input.command)

  for (const cmd of commands) {
    // Skip non-sed commands
    const trimmed = cmd.trim()
    const baseCmd = trimmed.split(/\s+/)[0]
    if (baseCmd !== 'sed') {
      continue
    }

    // In acceptEdits mode, allow file writes (-i flag) but still block dangerous operations
    const allowFileWrites = toolPermissionContext.mode === 'acceptEdits'

    const isAllowed = sedCommandIsAllowedByAllowlist(trimmed, {
      allowFileWrites,
    })

    if (!isAllowed) {
      return {
        behavior: 'ask',
        message:
          'sed command requires approval (contains potentially dangerous operations)',
        decisionReason: {
          type: 'other',
          reason:
            'sed command contains operations that require explicit approval (e.g., write commands, execute commands)',
        },
      }
    }
  }

  // No dangerous sed commands found (or no sed commands at all)
  return {
    behavior: 'passthrough',
    message: 'No dangerous sed operations detected',
  }
}
