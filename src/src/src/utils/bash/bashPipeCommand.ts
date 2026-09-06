import {
  hasMalformedTokens,
  hasShellQuoteSingleQuoteBug,
  type ParseEntry,
  quote,
  tryParseShellCommand,
} from './shellQuote.js'

/**
 * Rearranges a command with pipes to place stdin redirect after the first command.
 * This fixes an issue where eval treats the entire piped command as a single unit,
 * causing the stdin redirect to apply to eval itself rather than the first command.
 */
export function rearrangePipeCommand(command: string): string {
  // Skip if command has backticks - shell-quote doesn't handle them well
  if (command.includes('`')) {
    return quoteWithEvalStdinRedirect(command)
  }

  // Skip if command has command substitution - shell-quote parses $() incorrectly,
  // treating ( and ) as separate operators instead of recognizing command substitution
  if (command.includes('$(')) {
    return quoteWithEvalStdinRedirect(command)
  }

  // Skip if command references shell variables ($VAR, ${VAR}). shell-quote's parse()
  // expands these to empty string when no env is passed, silently dropping the
  // reference. Even if we preserved the token via an env function, quote() would
  // then escape the $ during rebuild, preventing runtime expansion. See #9732.
  if (/\$[A-Za-z_{]/.test(command)) {
    return quoteWithEvalStdinRedirect(command)
  }

  // Skip if command contains bash control structures (for/while/until/if/case/select)
  // shell-quote cannot parse these correctly and will incorrectly find pipes inside
  // the control structure body, breaking the command when rearranged
  if (containsControlStructure(command)) {
    return quoteWithEvalStdinRedirect(command)
  }

  // Join continuation lines before parsing: shell-quote doesn't handle \<newline>
  // and produces empty string tokens for each occurrence, causing spurious empty
  // arguments in the reconstructed command
  const joined = joinContinuationLines(command)

  // shell-quote treats bare newlines as whitespace, not command separators.
  // Parsing+rebuilding 'cmd1 | head\ncmd2 | grep' yields 'cmd1 | head cmd2 | grep',
  // silently merging pipelines. Line-continuation (\<newline>) is already stripped
  // above; any remaining newline is a real separator. Bail to the eval fallback,
  // which preserves the newline inside a single-quoted arg. See #32515.
  if (joined.includes('\n')) {
    return quoteWithEvalStdinRedirect(command)
  }

  // SECURITY: shell-quote treats \' inside single quotes as an escape, but
  // bash treats it as literal \ followed by a closing quote. The pattern
  // '\' <payload> '\' makes shell-quote merge <payload> into the quoted
  // string, hiding operators like ; from the token stream. Rebuilding from
  // that merged token can expose the operators when bash re-parses.
  if (hasShellQuoteSingleQuoteBug(joined)) {
    return quoteWithEvalStdinRedirect(command)
  }

  const parseResult = tryParseShellCommand(joined)

  // If parsing fails (malformed syntax), fall back to quoting the whole command
  if (!parseResult.success) {
    return quoteWithEvalStdinRedirect(command)
  }

  const parsed = parseResult.tokens

  // SECURITY: shell-quote tokenizes differently from bash. Input like
  // `echo {"hi":\"hi;calc.exe"}` is a bash syntax error (unbalanced quote),
  // but shell-quote parses it into tokens with `;` as an operator and
  // `calc.exe` as a separate word. Rebuilding from those tokens produces
  // valid bash that executes `calc.exe` — turning a syntax error into an
  // injection. Unbalanced delimiters in a string token signal this
  // misparsing; fall back to whole-command quoting, which preserves the
  // original (bash then rejects it with the same syntax error it would have
  // raised without us).
  if (hasMalformedTokens(joined, parsed)) {
    return quoteWithEvalStdinRedirect(command)
  }

  const firstPipeIndex = findFirstPipeOperator(parsed)

  if (firstPipeIndex <= 0) {
    return quoteWithEvalStdinRedirect(command)
  }

  // Rebuild: first_command < /dev/null | rest_of_pipeline
  const parts = [
    ...buildCommandParts(parsed, 0, firstPipeIndex),
    '< /dev/null',
    ...buildCommandParts(parsed, firstPipeIndex, parsed.length),
  ]

  return singleQuoteForEval(parts.join(' '))
}

/**
 * Finds the index of the first pipe operator in parsed shell command
 */
function findFirstPipeOperator(parsed: ParseEntry[]): number {
  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i]
    if (isOperator(entry, '|')) {
      return i
    }
  }
  return -1
}

/**
 * Builds command parts from parsed entries, handling strings and operators.
 * Special handling for file descriptor redirections to preserve them as single units.
 */
function buildCommandParts(
  parsed: ParseEntry[],
  start: number,
  end: number,
): string[] {
  const parts: string[] = []
  // Track if we've seen a non-env-var string token yet
  // Environment variables are only valid at the start of a command
  let seenNonEnvVar = false

  for (let i = start; i < end; i++) {
    const entry = parsed[i]

    // Check for file descriptor redirections (e.g., 2>&1, 2>/dev/null)
    if (
      typeof entry === 'string' &&
      /^[012]$/.test(entry) &&
      i + 2 < end &&
      isOperator(parsed[i + 1])
    ) {
      const op = parsed[i + 1] as { op: string }
      const target = parsed[i + 2]

      // Handle 2>&1 style redirections
      if (
        op.op === '>&' &&
        typeof target === 'string' &&
        /^[012]$/.test(target)
      ) {
        parts.push(`${entry}>&${target}`)
        i += 2
        continue
      }

      // Handle 2>/dev/null style redirections
      if (op.op === '>' && target === '/dev/null') {
        parts.push(`${entry}>/dev/null`)
        i += 2
        continue
      }

      // Handle 2> &1 style (space between > and &1)
      if (
        op.op === '>' &&
        typeof target === 'string' &&
        target.startsWith('&')
      ) {
        const fd = target.slice(1)
        if (/^[012]$/.test(fd)) {
          parts.push(`${entry}>&${fd}`)
          i += 2
          continue
        }
      }
    }

    // Handle regular entries
    if (typeof entry === 'string') {
      // Environment variable assignments are only valid at the start of a command,
      // before any non-env-var tokens (the actual command and its arguments)
      const isEnvVar = !seenNonEnvVar && isEnvironmentVariableAssignment(entry)

      if (isEnvVar) {
        // For env var assignments, we need to preserve the = but quote the value if needed
        // Split into name and value parts
        const eqIndex = entry.indexOf('=')
        const name = entry.slice(0, eqIndex)
        const value = entry.slice(eqIndex + 1)

        // Quote the value part to handle spaces and special characters
        const quotedValue = quote([value])
        parts.push(`${name}=${quotedValue}`)
      } else {
        // Once we see a non-env-var string, all subsequent strings are arguments
        seenNonEnvVar = true
        parts.push(quote([entry]))
      }
    } else if (isOperator(entry)) {
      // Special handling for glob operators
      if (entry.op === 'glob' && 'pattern' in entry) {
        // Don't quote glob patterns - they need to remain as-is for shell expansion
        parts.push(entry.pattern as string)
      } else {
        parts.push(entry.op)
        // Reset after command separators - the next command can have its own env vars
        if (isCommandSeparator(entry.op)) {
          seenNonEnvVar = false
        }
      }
    }
  }

  return parts
}

/**
 * Checks if a string is an environment variable assignment (VAR=value)
 * Environment variable names must start with letter or underscore,
 * followed by letters, numbers, or underscores
 */
function isEnvironmentVariableAssignment(str: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(str)
}

/**
 * Checks if an operator is a command separator that starts a new command context.
 * After these operators, environment variable assignments are valid again.
 */
function isCommandSeparator(op: string): boolean {
  return op === '&&' || op === '||' || op === ';'
}

/**
 * Type guard to check if a parsed entry is an operator
 */
function isOperator(entry: unknown, op?: string): entry is { op: string } {
  if (!entry || typeof entry !== 'object' || !('op' in entry)) {
    return false
  }
  return op ? entry.op === op : true
}

/**
 * Checks if a command contains bash control structures that shell-quote cannot parse.
 * These include for/while/until/if/case/select loops and conditionals.
 * We match keywords followed by whitespace to avoid false positives with commands
 * or arguments that happen to contain these words.
 */
function containsControlStructure(command: string): boolean {
  return /\b(for|while|until|if|case|select)\s/.test(command)
}

/**
 * Quotes a command and adds `< /dev/null` as a shell redirect on eval, rather than
 * as an eval argument. This is critical for pipe commands where we can't parse the
 * pipe boundary (e.g., commands with $(), backticks, or control structures).
 *
 * Using `singleQuoteForEval(cmd) + ' < /dev/null'` produces: eval 'cmd' < /dev/null
 *   → eval's stdin is /dev/null, eval evaluates 'cmd', pipes inside work correctly
 *
 * The previous approach `quote([cmd, '<', '/dev/null'])` produced: eval 'cmd' \< /dev/null
 *   → eval concatenates args to 'cmd < /dev/null', redirect applies to LAST pipe command
 */
function quoteWithEvalStdinRedirect(command: string): string {
  return singleQuoteForEval(command) + ' < /dev/null'
}

/**
 * Single-quote a string for use as an eval argument. Escapes embedded single
 * quotes via '"'"' (close-sq, literal-sq-in-dq, reopen-sq). Used instead of
 * shell-quote's quote() which switches to double-quote mode when the input
 * contains single quotes and then escapes ! -> \!, corrupting jq/awk filters
 * like `select(.x != .y)` into `select(.x \!= .y)`.
 */
function singleQuoteForEval(s: string): string {
  return "'" + s.replace(/'/g, `'"'"'`) + "'"
}

/**
 * Joins shell continuation lines (backslash-newline) into a single line.
 * Only joins when there's an odd number of backslashes before the newline
 * (the last one escapes the newline). Even backslashes pair up as escape
 * sequences and the newline remains a separator.
 */
function joinContinuationLines(command: string): string {
  return command.replace(/\\+\n/g, match => {
    const backslashCount = match.length - 1 // -1 for the newline
    if (backslashCount % 2 === 1) {
      // Odd number: last backslash escapes the newline (line continuation)
      return '\\'.repeat(backslashCount - 1)
    } else {
      // Even number: all pair up, newline is a real separator
      return match
    }
  })
}
