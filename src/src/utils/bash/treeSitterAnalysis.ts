/**
 * Tree-sitter AST analysis utilities for bash command security validation.
 *
 * These functions extract security-relevant information from tree-sitter
 * parse trees, providing more accurate analysis than regex/shell-quote
 * parsing. Each function takes a root node and command string, and returns
 * structured data that can be used by security validators.
 *
 * The native NAPI parser returns plain JS objects — no cleanup needed.
 */

type TreeSitterNode = {
  type: string
  text: string
  startIndex: number
  endIndex: number
  children: TreeSitterNode[]
  childCount: number
}

export type QuoteContext = {
  /** Command text with single-quoted content removed (double-quoted content preserved) */
  withDoubleQuotes: string
  /** Command text with all quoted content removed */
  fullyUnquoted: string
  /** Like fullyUnquoted but preserves quote characters (', ") */
  unquotedKeepQuoteChars: string
}

export type CompoundStructure = {
  /** Whether the command has compound operators (&&, ||, ;) at the top level */
  hasCompoundOperators: boolean
  /** Whether the command has pipelines */
  hasPipeline: boolean
  /** Whether the command has subshells */
  hasSubshell: boolean
  /** Whether the command has command groups ({...}) */
  hasCommandGroup: boolean
  /** Top-level compound operator types found */
  operators: string[]
  /** Individual command segments split by compound operators */
  segments: string[]
}

export type DangerousPatterns = {
  /** Has $() or backtick command substitution (outside quotes that would make it safe) */
  hasCommandSubstitution: boolean
  /** Has <() or >() process substitution */
  hasProcessSubstitution: boolean
  /** Has ${...} parameter expansion */
  hasParameterExpansion: boolean
  /** Has heredoc */
  hasHeredoc: boolean
  /** Has comment */
  hasComment: boolean
}

export type TreeSitterAnalysis = {
  quoteContext: QuoteContext
  compoundStructure: CompoundStructure
  /** Whether actual operator nodes (;, &&, ||) exist — if false, \; is just a word argument */
  hasActualOperatorNodes: boolean
  dangerousPatterns: DangerousPatterns
}

type QuoteSpans = {
  raw: Array<[number, number]> // raw_string (single-quoted)
  ansiC: Array<[number, number]> // ansi_c_string ($'...')
  double: Array<[number, number]> // string (double-quoted)
  heredoc: Array<[number, number]> // quoted heredoc_redirect
}

/**
 * Single-pass collection of all quote-related spans.
 * Previously this was 5 separate tree walks (one per type-set plus
 * allQuoteTypes plus heredoc); fusing cuts tree-traversal ~5x.
 *
 * Replicates the per-type walk semantics: each original walk stopped at
 * its own type. So the raw_string walk would recurse THROUGH a string
 * node (not its type) to reach nested raw_string inside $(...), but the
 * string walk would stop at the outer string. We track `inDouble` to
 * collect the *outermost* string span per path, while still descending
 * into $()/${} bodies to pick up inner raw_string/ansi_c_string.
 *
 * raw_string / ansi_c_string / quoted-heredoc bodies are literal text
 * in bash (no expansion), so no nested quote nodes exist — return early.
 */
function collectQuoteSpans(
  node: TreeSitterNode,
  out: QuoteSpans,
  inDouble: boolean,
): void {
  switch (node.type) {
    case 'raw_string':
      out.raw.push([node.startIndex, node.endIndex])
      return // literal body, no nested quotes possible
    case 'ansi_c_string':
      out.ansiC.push([node.startIndex, node.endIndex])
      return // literal body
    case 'string':
      // Only collect the outermost string (matches old per-type walk
      // which stops at first match). Recurse regardless — a nested
      // $(cmd 'x') inside "..." has a real inner raw_string.
      if (!inDouble) out.double.push([node.startIndex, node.endIndex])
      for (const child of node.children) {
        if (child) collectQuoteSpans(child, out, true)
      }
      return
    case 'heredoc_redirect': {
      // Quoted heredocs (<<'EOF', <<"EOF", <<\EOF): literal body.
      // Unquoted (<<EOF) expands $()/${} — the body can contain
      // $(cmd 'x') whose inner '...' IS a real raw_string node.
      // Detection: heredoc_start text starts with '/"/\\
      // Matches sync path's extractHeredocs({ quotedOnly: true }).
      let isQuoted = false
      for (const child of node.children) {
        if (child && child.type === 'heredoc_start') {
          const first = child.text[0]
          isQuoted = first === "'" || first === '"' || first === '\\'
          break
        }
      }
      if (isQuoted) {
        out.heredoc.push([node.startIndex, node.endIndex])
        return // literal body, no nested quote nodes
      }
      // Unquoted: recurse into heredoc_body → command_substitution →
      // inner quote nodes. The original per-type walks did NOT stop at
      // heredoc_redirect (not in their type sets), so they recursed here.
      break
    }
  }

  for (const child of node.children) {
    if (child) collectQuoteSpans(child, out, inDouble)
  }
}

/**
 * Builds a Set of all character positions covered by the given spans.
 */
function buildPositionSet(spans: Array<[number, number]>): Set<number> {
  const set = new Set<number>()
  for (const [start, end] of spans) {
    for (let i = start; i < end; i++) {
      set.add(i)
    }
  }
  return set
}

/**
 * Drops spans that are fully contained within another span, keeping only the
 * outermost. Nested quotes (e.g., `"$(echo 'hi')"`) yield overlapping spans
 * — the inner raw_string is found by recursing into the outer string node.
 * Processing overlapping spans corrupts indices since removing/replacing the
 * outer span shifts the inner span's start/end into stale positions.
 */
function dropContainedSpans<T extends readonly [number, number, ...unknown[]]>(
  spans: T[],
): T[] {
  return spans.filter(
    (s, i) =>
      !spans.some(
        (other, j) =>
          j !== i &&
          other[0] <= s[0] &&
          other[1] >= s[1] &&
          (other[0] < s[0] || other[1] > s[1]),
      ),
  )
}

/**
 * Removes spans from a string, returning the string with those character
 * ranges removed.
 */
function removeSpans(command: string, spans: Array<[number, number]>): string {
  if (spans.length === 0) return command

  // Drop inner spans that are fully contained in an outer one, then sort by
  // start index descending so we can splice without offset shifts.
  const sorted = dropContainedSpans(spans).sort((a, b) => b[0] - a[0])
  let result = command
  for (const [start, end] of sorted) {
    result = result.slice(0, start) + result.slice(end)
  }
  return result
}

/**
 * Replaces spans with just the quote delimiters (preserving ' and " characters).
 */
function replaceSpansKeepQuotes(
  command: string,
  spans: Array<[number, number, string, string]>,
): string {
  if (spans.length === 0) return command

  const sorted = dropContainedSpans(spans).sort((a, b) => b[0] - a[0])
  let result = command
  for (const [start, end, open, close] of sorted) {
    // Replace content but keep the quote delimiters
    result = result.slice(0, start) + open + close + result.slice(end)
  }
  return result
}

/**
 * Extract quote context from the tree-sitter AST.
 * Replaces the manual character-by-character extractQuotedContent() function.
 *
 * Tree-sitter node types:
 * - raw_string: single-quoted ('...')
 * - string: double-quoted ("...")
 * - ansi_c_string: ANSI-C quoting ($'...') — span includes the leading $
 * - heredoc_redirect: QUOTED heredocs only (<<'EOF', <<"EOF", <<\EOF) —
 *   the full redirect span (<<, delimiters, body, newlines) is stripped
 *   since the body is literal text in bash (no expansion). UNQUOTED
 *   heredocs (<<EOF) are left in place since bash expands $(...)/${...}
 *   inside them, and validators need to see those patterns. Matches the
 *   sync path's extractHeredocs({ quotedOnly: true }).
 */
export function extractQuoteContext(
  rootNode: unknown,
  command: string,
): QuoteContext {
  // Single walk collects all quote span types at once.
  const spans: QuoteSpans = { raw: [], ansiC: [], double: [], heredoc: [] }
  collectQuoteSpans(rootNode as TreeSitterNode, spans, false)
  const singleQuoteSpans = spans.raw
  const ansiCSpans = spans.ansiC
  const doubleQuoteSpans = spans.double
  const quotedHeredocSpans = spans.heredoc
  const allQuoteSpans = [
    ...singleQuoteSpans,
    ...ansiCSpans,
    ...doubleQuoteSpans,
    ...quotedHeredocSpans,
  ]

  // Build a set of positions that should be excluded for each output variant.
  // For withDoubleQuotes: remove single-quoted spans entirely, plus the
  // opening/closing `"` delimiters of double-quoted spans (but keep the
  // content between them). This matches the regex extractQuotedContent()
  // semantics where `"` toggles quote state but content is still emitted.
  const singleQuoteSet = buildPositionSet([
    ...singleQuoteSpans,
    ...ansiCSpans,
    ...quotedHeredocSpans,
  ])
  const doubleQuoteDelimSet = new Set<number>()
  for (const [start, end] of doubleQuoteSpans) {
    doubleQuoteDelimSet.add(start) // opening "
    doubleQuoteDelimSet.add(end - 1) // closing "
  }
  let withDoubleQuotes = ''
  for (let i = 0; i < command.length; i++) {
    if (singleQuoteSet.has(i)) continue
    if (doubleQuoteDelimSet.has(i)) continue
    withDoubleQuotes += command[i]
  }

  // fullyUnquoted: remove all quoted content
  const fullyUnquoted = removeSpans(command, allQuoteSpans)

  // unquotedKeepQuoteChars: remove content but keep delimiter chars
  const spansWithQuoteChars: Array<[number, number, string, string]> = []
  for (const [start, end] of singleQuoteSpans) {
    spansWithQuoteChars.push([start, end, "'", "'"])
  }
  for (const [start, end] of ansiCSpans) {
    // ansi_c_string spans include the leading $; preserve it so this
    // matches the regex path, which treats $ as unquoted preceding '.
    spansWithQuoteChars.push([start, end, "$'", "'"])
  }
  for (const [start, end] of doubleQuoteSpans) {
    spansWithQuoteChars.push([start, end, '"', '"'])
  }
  for (const [start, end] of quotedHeredocSpans) {
    // Heredoc redirect spans have no inline quote delimiters — strip entirely.
    spansWithQuoteChars.push([start, end, '', ''])
  }
  const unquotedKeepQuoteChars = replaceSpansKeepQuotes(
    command,
    spansWithQuoteChars,
  )

  return { withDoubleQuotes, fullyUnquoted, unquotedKeepQuoteChars }
}

/**
 * Extract compound command structure from the AST.
 * Replaces isUnsafeCompoundCommand() and splitCommand() for tree-sitter path.
 */
export function extractCompoundStructure(
  rootNode: unknown,
  command: string,
): CompoundStructure {
  const n = rootNode as TreeSitterNode
  const operators: string[] = []
  const segments: string[] = []
  let hasSubshell = false
  let hasCommandGroup = false
  let hasPipeline = false

  // Walk top-level children of the program node
  function walkTopLevel(node: TreeSitterNode): void {
    for (const child of node.children) {
      if (!child) continue

      if (child.type === 'list') {
        // list nodes contain && and || operators
        for (const listChild of child.children) {
          if (!listChild) continue
          if (listChild.type === '&&' || listChild.type === '||') {
            operators.push(listChild.type)
          } else if (
            listChild.type === 'list' ||
            listChild.type === 'redirected_statement'
          ) {
            // Nested list, or redirected_statement wrapping a list/pipeline —
            // recurse so inner operators/pipelines are detected. For
            // `cmd1 && cmd2 2>/dev/null && cmd3`, the redirected_statement
            // wraps `list(cmd1 && cmd2)` — the inner `&&` would be missed
            // without recursion.
            walkTopLevel({ ...node, children: [listChild] } as TreeSitterNode)
          } else if (listChild.type === 'pipeline') {
            hasPipeline = true
            segments.push(listChild.text)
          } else if (listChild.type === 'subshell') {
            hasSubshell = true
            segments.push(listChild.text)
          } else if (listChild.type === 'compound_statement') {
            hasCommandGroup = true
            segments.push(listChild.text)
          } else {
            segments.push(listChild.text)
          }
        }
      } else if (child.type === ';') {
        operators.push(';')
      } else if (child.type === 'pipeline') {
        hasPipeline = true
        segments.push(child.text)
      } else if (child.type === 'subshell') {
        hasSubshell = true
        segments.push(child.text)
      } else if (child.type === 'compound_statement') {
        hasCommandGroup = true
        segments.push(child.text)
      } else if (
        child.type === 'command' ||
        child.type === 'declaration_command' ||
        child.type === 'variable_assignment'
      ) {
        segments.push(child.text)
      } else if (child.type === 'redirected_statement') {
        // `cd ~/src && find path 2>/dev/null` — tree-sitter wraps the ENTIRE
        // compound in a redirected_statement: program → redirected_statement →
        // (list → cmd1, &&, cmd2) + file_redirect. Same for `cmd1 | cmd2 > out`
        // (wraps pipeline) and `(cmd) > out` (wraps subshell). Recurse to
        // detect the inner structure; skip file_redirect children (redirects
        // don't affect compound/pipeline classification).
        let foundInner = false
        for (const inner of child.children) {
          if (!inner || inner.type === 'file_redirect') continue
          foundInner = true
          walkTopLevel({ ...child, children: [inner] } as TreeSitterNode)
        }
        if (!foundInner) {
          // Standalone redirect with no body (shouldn't happen, but fail-safe)
          segments.push(child.text)
        }
      } else if (child.type === 'negated_command') {
        // `! cmd` — recurse into the inner command so its structure is
        // classified (pipeline/subshell/etc.), but also record the full
        // negated text as a segment so segments.length stays meaningful.
        segments.push(child.text)
        walkTopLevel(child)
      } else if (
        child.type === 'if_statement' ||
        child.type === 'while_statement' ||
        child.type === 'for_statement' ||
        child.type === 'case_statement' ||
        child.type === 'function_definition'
      ) {
        // Control-flow constructs: the construct itself is one segment,
        // but recurse so inner pipelines/subshells/operators are detected.
        segments.push(child.text)
        walkTopLevel(child)
      }
    }
  }

  walkTopLevel(n)

  // If no segments found, the whole command is one segment
  if (segments.length === 0) {
    segments.push(command)
  }

  return {
    hasCompoundOperators: operators.length > 0,
    hasPipeline,
    hasSubshell,
    hasCommandGroup,
    operators,
    segments,
  }
}

/**
 * Check whether the AST contains actual operator nodes (;, &&, ||).
 *
 * This is the key function for eliminating the `find -exec \;` false positive.
 * Tree-sitter parses `\;` as part of a `word` node (an argument to find),
 * NOT as a `;` operator. So if no actual `;` operator nodes exist in the AST,
 * there are no compound operators and hasBackslashEscapedOperator() can be skipped.
 */
export function hasActualOperatorNodes(rootNode: unknown): boolean {
  const n = rootNode as TreeSitterNode

  function walk(node: TreeSitterNode): boolean {
    // Check for operator types that indicate compound commands
    if (node.type === ';' || node.type === '&&' || node.type === '||') {
      // Verify this is a child of a list or program, not inside a command
      return true
    }

    if (node.type === 'list') {
      // A list node means there are compound operators
      return true
    }

    for (const child of node.children) {
      if (child && walk(child)) return true
    }
    return false
  }

  return walk(n)
}

/**
 * Extract dangerous pattern information from the AST.
 */
export function extractDangerousPatterns(rootNode: unknown): DangerousPatterns {
  const n = rootNode as TreeSitterNode
  let hasCommandSubstitution = false
  let hasProcessSubstitution = false
  let hasParameterExpansion = false
  let hasHeredoc = false
  let hasComment = false

  function walk(node: TreeSitterNode): void {
    switch (node.type) {
      case 'command_substitution':
        hasCommandSubstitution = true
        break
      case 'process_substitution':
        hasProcessSubstitution = true
        break
      case 'expansion':
        hasParameterExpansion = true
        break
      case 'heredoc_redirect':
        hasHeredoc = true
        break
      case 'comment':
        hasComment = true
        break
    }

    for (const child of node.children) {
      if (child) walk(child)
    }
  }

  walk(n)

  return {
    hasCommandSubstitution,
    hasProcessSubstitution,
    hasParameterExpansion,
    hasHeredoc,
    hasComment,
  }
}

/**
 * Perform complete tree-sitter analysis of a command.
 * Extracts all security-relevant data from the AST in one pass.
 * This data must be extracted before tree.delete() is called.
 */
export function analyzeCommand(
  rootNode: unknown,
  command: string,
): TreeSitterAnalysis {
  return {
    quoteContext: extractQuoteContext(rootNode, command),
    compoundStructure: extractCompoundStructure(rootNode, command),
    hasActualOperatorNodes: hasActualOperatorNodes(rootNode),
    dangerousPatterns: extractDangerousPatterns(rootNode),
  }
}
