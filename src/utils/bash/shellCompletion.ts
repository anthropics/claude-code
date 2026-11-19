import type { SuggestionItem } from 'src/components/PromptInput/PromptInputFooterSuggestions.js'
import {
  type ParseEntry,
  quote,
  tryParseShellCommand,
} from '../bash/shellQuote.js'
import { logForDebugging } from '../debug.js'
import { getShellType } from '../localInstaller.js'
import * as Shell from '../Shell.js'

// Constants
const MAX_SHELL_COMPLETIONS = 15
const SHELL_COMPLETION_TIMEOUT_MS = 1000
const COMMAND_OPERATORS = ['|', '||', '&&', ';'] as const

export type ShellCompletionType = 'command' | 'variable' | 'file'

type InputContext = {
  prefix: string
  completionType: ShellCompletionType
}

/**
 * Check if a parsed token is a command operator (|, ||, &&, ;)
 */
function isCommandOperator(token: ParseEntry): boolean {
  return (
    typeof token === 'object' &&
    token !== null &&
    'op' in token &&
    (COMMAND_OPERATORS as readonly string[]).includes(token.op as string)
  )
}

/**
 * Determine completion type based solely on prefix characteristics
 */
function getCompletionTypeFromPrefix(prefix: string): ShellCompletionType {
  if (prefix.startsWith('$')) {
    return 'variable'
  }
  if (
    prefix.includes('/') ||
    prefix.startsWith('~') ||
    prefix.startsWith('.')
  ) {
    return 'file'
  }
  return 'command'
}

/**
 * Find the last string token and its index in parsed tokens
 */
function findLastStringToken(
  tokens: ParseEntry[],
): { token: string; index: number } | null {
  const i = tokens.findLastIndex(t => typeof t === 'string')
  return i !== -1 ? { token: tokens[i] as string, index: i } : null
}

/**
 * Check if we're in a context that expects a new command
 * (at start of input or after a command operator)
 */
function isNewCommandContext(
  tokens: ParseEntry[],
  currentTokenIndex: number,
): boolean {
  if (currentTokenIndex === 0) {
    return true
  }
  const prevToken = tokens[currentTokenIndex - 1]
  return prevToken !== undefined && isCommandOperator(prevToken)
}

/**
 * Parse input to extract completion context
 */
function parseInputContext(input: string, cursorOffset: number): InputContext {
  const beforeCursor = input.slice(0, cursorOffset)

  // Check if it's a variable prefix, before expanding with shell-quote
  const varMatch = beforeCursor.match(/\$[a-zA-Z_][a-zA-Z0-9_]*$/)
  if (varMatch) {
    return { prefix: varMatch[0], completionType: 'variable' }
  }

  // Parse with shell-quote
  const parseResult = tryParseShellCommand(beforeCursor)
  if (!parseResult.success) {
    // Fallback to simple parsing
    const tokens = beforeCursor.split(/\s+/)
    const prefix = tokens[tokens.length - 1] || ''
    const isFirstToken = tokens.length === 1 && !beforeCursor.includes(' ')
    const completionType = isFirstToken
      ? 'command'
      : getCompletionTypeFromPrefix(prefix)
    return { prefix, completionType }
  }

  // Extract current token
  const lastToken = findLastStringToken(parseResult.tokens)
  if (!lastToken) {
    // No string token found - check if after operator
    const lastParsedToken = parseResult.tokens[parseResult.tokens.length - 1]
    const completionType =
      lastParsedToken && isCommandOperator(lastParsedToken)
        ? 'command'
        : 'command' // Default to command at start
    return { prefix: '', completionType }
  }

  // If there's a trailing space, the user is starting a new argument
  if (beforeCursor.endsWith(' ')) {
    // After first token (command) with space = file argument expected
    return { prefix: '', completionType: 'file' }
  }

  // Determine completion type from context
  const baseType = getCompletionTypeFromPrefix(lastToken.token)

  // If it's clearly a file or variable based on prefix, use that type
  if (baseType === 'variable' || baseType === 'file') {
    return { prefix: lastToken.token, completionType: baseType }
  }

  // For command-like tokens, check context: are we starting a new command?
  const completionType = isNewCommandContext(
    parseResult.tokens,
    lastToken.index,
  )
    ? 'command'
    : 'file' // Not after operator = file argument

  return { prefix: lastToken.token, completionType }
}

/**
 * Generate bash completion command using compgen
 */
function getBashCompletionCommand(
  prefix: string,
  completionType: ShellCompletionType,
): string {
  if (completionType === 'variable') {
    // Variable completion - remove $ prefix
    const varName = prefix.slice(1)
    return `compgen -v ${quote([varName])} 2>/dev/null`
  } else if (completionType === 'file') {
    // File completion with trailing slash for directories and trailing space for files
    // Use 'while read' to prevent command injection from filenames containing newlines
    return `compgen -f ${quote([prefix])} 2>/dev/null | head -${MAX_SHELL_COMPLETIONS} | while IFS= read -r f; do [ -d "$f" ] && echo "$f/" || echo "$f "; done`
  } else {
    // Command completion
    return `compgen -c ${quote([prefix])} 2>/dev/null`
  }
}

/**
 * Generate zsh completion command using native zsh commands
 */
function getZshCompletionCommand(
  prefix: string,
  completionType: ShellCompletionType,
): string {
  if (completionType === 'variable') {
    // Variable completion - use zsh pattern matching for safe filtering
    const varName = prefix.slice(1)
    return `print -rl -- \${(k)parameters[(I)${quote([varName])}*]} 2>/dev/null`
  } else if (completionType === 'file') {
    // File completion with trailing slash for directories and trailing space for files
    // Note: zsh glob expansion is safe from command injection (unlike bash for-in loops)
    return `for f in ${quote([prefix])}*(N[1,${MAX_SHELL_COMPLETIONS}]); do [[ -d "$f" ]] && echo "$f/" || echo "$f "; done`
  } else {
    // Command completion - use zsh pattern matching for safe filtering
    return `print -rl -- \${(k)commands[(I)${quote([prefix])}*]} 2>/dev/null`
  }
}

/**
 * Get completions for the given shell type
 */
async function getCompletionsForShell(
  shellType: 'bash' | 'zsh',
  prefix: string,
  completionType: ShellCompletionType,
  abortSignal: AbortSignal,
): Promise<SuggestionItem[]> {
  let command: string

  if (shellType === 'bash') {
    command = getBashCompletionCommand(prefix, completionType)
  } else if (shellType === 'zsh') {
    command = getZshCompletionCommand(prefix, completionType)
  } else {
    // Unsupported shell type
    return []
  }

  const shellCommand = await Shell.exec(command, abortSignal, 'bash', {
    timeout: SHELL_COMPLETION_TIMEOUT_MS,
  })
  const result = await shellCommand.result
  return result.stdout
    .split('\n')
    .filter((line: string) => line.trim())
    .slice(0, MAX_SHELL_COMPLETIONS)
    .map((text: string) => ({
      id: text,
      displayText: text,
      description: undefined,
      metadata: { completionType },
    }))
}

/**
 * Get shell completions for the given input
 * Supports bash and zsh shells (matches Shell.ts execution support)
 */
export async function getShellCompletions(
  input: string,
  cursorOffset: number,
  abortSignal: AbortSignal,
): Promise<SuggestionItem[]> {
  const shellType = getShellType()

  // Only support bash/zsh (matches Shell.ts execution support)
  if (shellType !== 'bash' && shellType !== 'zsh') {
    return []
  }

  try {
    const { prefix, completionType } = parseInputContext(input, cursorOffset)

    if (!prefix) {
      return []
    }

    const completions = await getCompletionsForShell(
      shellType,
      prefix,
      completionType,
      abortSignal,
    )

    // Add inputSnapshot to all suggestions so we can detect when input changes
    return completions.map(suggestion => ({
      ...suggestion,
      metadata: {
        ...(suggestion.metadata as { completionType: ShellCompletionType }),
        inputSnapshot: input,
      },
    }))
  } catch (error) {
    logForDebugging(`Shell completion failed: ${error}`)
    return [] // Silent fail
  }
}
