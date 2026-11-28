import { quote } from './shellQuote.js'

/**
 * Detects if a command contains a heredoc pattern
 * Matches patterns like: <<EOF, <<'EOF', <<"EOF", <<-EOF, <<-'EOF', <<\EOF, etc.
 */
function containsHeredoc(command: string): boolean {
  // Match heredoc patterns: << followed by optional -, then optional quotes or backslash, then word
  // Matches: <<EOF, <<'EOF', <<"EOF", <<-EOF, <<-'EOF', <<\EOF
  // Check for bit-shift operators first and exclude them
  if (
    /\d\s*<<\s*\d/.test(command) ||
    /\[\[\s*\d+\s*<<\s*\d+\s*\]\]/.test(command) ||
    /\$\(\(.*<<.*\)\)/.test(command)
  ) {
    return false
  }

  // Now check for heredoc patterns
  const heredocRegex = /<<-?\s*(?:(['"]?)(\w+)\1|\\(\w+))/
  return heredocRegex.test(command)
}

/**
 * Detects if a command contains multiline strings in quotes
 */
function containsMultilineString(command: string): boolean {
  // Check for strings with actual newlines in them
  // Handle escaped quotes by using a more sophisticated pattern
  // Match single quotes: '...\n...' where content can include escaped quotes \'
  // Match double quotes: "...\n..." where content can include escaped quotes \"
  const singleQuoteMultiline = /'(?:[^'\\]|\\.)*\n(?:[^'\\]|\\.)*'/
  const doubleQuoteMultiline = /"(?:[^"\\]|\\.)*\n(?:[^"\\]|\\.)*"/

  return (
    singleQuoteMultiline.test(command) || doubleQuoteMultiline.test(command)
  )
}

/**
 * Quotes a shell command appropriately, preserving heredocs and multiline strings
 * @param command The command to quote
 * @param addStdinRedirect Whether to add < /dev/null
 * @returns The properly quoted command
 */
export function quoteShellCommand(
  command: string,
  addStdinRedirect: boolean = true,
): string {
  // If command contains heredoc or multiline strings, handle specially
  // The shell-quote library incorrectly escapes ! to \! in these cases
  if (containsHeredoc(command) || containsMultilineString(command)) {
    // For heredocs and multiline strings, we need to quote for eval
    // but avoid shell-quote's aggressive escaping
    // We'll use single quotes and escape only single quotes in the command
    const escaped = command.replace(/'/g, "'\"'\"'")
    const quoted = `'${escaped}'`

    // Don't add stdin redirect for heredocs as they provide their own input
    if (containsHeredoc(command)) {
      return quoted
    }

    // For multiline strings without heredocs, add stdin redirect if needed
    return addStdinRedirect ? `${quoted} < /dev/null` : quoted
  }

  // For regular commands, use shell-quote
  if (addStdinRedirect) {
    return quote([command, '<', '/dev/null'])
  }

  return quote([command])
}

/**
 * Detects if a command already has a stdin redirect
 * Match patterns like: < file, </path/to/file, < /dev/null, etc.
 * But not <<EOF (heredoc), << (bit shift), or <(process substitution)
 */
export function hasStdinRedirect(command: string): boolean {
  // Look for < followed by whitespace and a filename/path
  // Negative lookahead to exclude: <<, <(
  // Must be preceded by whitespace or command separator or start of string
  return /(?:^|[\s;&|])<(?![<(])\s*\S+/.test(command)
}

/**
 * Checks if stdin redirect should be added to a command
 * @param command The command to check
 * @returns true if stdin redirect can be safely added
 */
export function shouldAddStdinRedirect(command: string): boolean {
  // Don't add stdin redirect for heredocs as it interferes with the heredoc terminator
  if (containsHeredoc(command)) {
    return false
  }

  // Don't add stdin redirect if command already has one
  if (hasStdinRedirect(command)) {
    return false
  }

  // For other commands, stdin redirect is generally safe
  return true
}

/**
 * Rewrites Windows CMD-style `>nul` redirects to POSIX `/dev/null`.
 *
 * The model occasionally hallucinates Windows CMD syntax (e.g., `ls 2>nul`)
 * even though our bash shell is always POSIX (Git Bash / WSL on Windows).
 * When Git Bash sees `2>nul`, it creates a literal file named `nul` — a
 * Windows reserved device name that is extremely hard to delete and breaks
 * `git add .` and `git clone`. See anthropics/claude-code#4928.
 *
 * Matches: `>nul`, `> NUL`, `2>nul`, `&>nul`, `>>nul` (case-insensitive)
 * Does NOT match: `>null`, `>nullable`, `>nul.txt`, `cat nul.txt`
 *
 * Limitation: this regex does not parse shell quoting, so `echo ">nul"`
 * will also be rewritten. This is acceptable collateral — it's extremely
 * rare and rewriting to `/dev/null` inside a string is harmless.
 */
const NUL_REDIRECT_REGEX = /(\d?&?>+\s*)[Nn][Uu][Ll](?=\s|$|[|&;)\n])/g

export function rewriteWindowsNullRedirect(command: string): string {
  return command.replace(NUL_REDIRECT_REGEX, '$1/dev/null')
}
