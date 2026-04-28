/**
 * Pure-TypeScript bash parser producing tree-sitter-bash-compatible ASTs.
 *
 * Downstream code in parser.ts, ast.ts, prefix.ts, ParsedCommand.ts walks this
 * by field name. startIndex/endIndex are UTF-8 BYTE offsets (not JS string
 * indices).
 *
 * Grammar reference: tree-sitter-bash. Validated against a 3449-input golden
 * corpus generated from the WASM parser.
 */

export type TsNode = {
  type: string
  text: string
  startIndex: number
  endIndex: number
  children: TsNode[]
}

type ParserModule = {
  parse: (source: string, timeoutMs?: number) => TsNode | null
}

/**
 * 50ms wall-clock cap — bails out on pathological/adversarial input.
 * Pass `Infinity` via `parse(src, Infinity)` to disable (e.g. correctness
 * tests, where CI jitter would otherwise cause spurious null returns).
 */
const PARSE_TIMEOUT_MS = 50

/** Node budget cap — bails out before OOM on deeply nested input. */
const MAX_NODES = 50_000

const MODULE: ParserModule = { parse: parseSource }

const READY = Promise.resolve()

/** No-op: pure-TS parser needs no async init. Kept for API compatibility. */
export function ensureParserInitialized(): Promise<void> {
  return READY
}

/** Always succeeds — pure-TS needs no init. */
export function getParserModule(): ParserModule | null {
  return MODULE
}

// ───────────────────────────── Tokenizer ─────────────────────────────

type TokenType =
  | 'WORD'
  | 'NUMBER'
  | 'OP'
  | 'NEWLINE'
  | 'COMMENT'
  | 'DQUOTE'
  | 'SQUOTE'
  | 'ANSI_C'
  | 'DOLLAR'
  | 'DOLLAR_PAREN'
  | 'DOLLAR_BRACE'
  | 'DOLLAR_DPAREN'
  | 'BACKTICK'
  | 'LT_PAREN'
  | 'GT_PAREN'
  | 'EOF'

type Token = {
  type: TokenType
  value: string
  /** UTF-8 byte offset of first char */
  start: number
  /** UTF-8 byte offset one past last char */
  end: number
}

const SPECIAL_VARS = new Set(['?', '$', '@', '*', '#', '-', '!', '_'])

const DECL_KEYWORDS = new Set([
  'export',
  'declare',
  'typeset',
  'readonly',
  'local',
])

export const SHELL_KEYWORDS = new Set([
  'if',
  'then',
  'elif',
  'else',
  'fi',
  'while',
  'until',
  'for',
  'in',
  'do',
  'done',
  'case',
  'esac',
  'function',
  'select',
])

/**
 * Lexer state. Tracks both JS-string index (for charAt) and UTF-8 byte offset
 * (for TsNode positions). ASCII fast path: byte == char index. Non-ASCII
 * advances byte count per-codepoint.
 */
type Lexer = {
  src: string
  len: number
  /** JS string index */
  i: number
  /** UTF-8 byte offset */
  b: number
  /** Pending heredoc delimiters awaiting body scan at next newline */
  heredocs: HeredocPending[]
  /** Precomputed byte offset for each char index (lazy for non-ASCII) */
  byteTable: Uint32Array | null
}

type HeredocPending = {
  delim: string
  stripTabs: boolean
  quoted: boolean
  /** Filled after body scan */
  bodyStart: number
  bodyEnd: number
  endStart: number
  endEnd: number
}

function makeLexer(src: string): Lexer {
  return {
    src,
    len: src.length,
    i: 0,
    b: 0,
    heredocs: [],
    byteTable: null,
  }
}

/** Advance one JS char, updating byte offset for UTF-8. */
function advance(L: Lexer): void {
  const c = L.src.charCodeAt(L.i)
  L.i++
  if (c < 0x80) {
    L.b++
  } else if (c < 0x800) {
    L.b += 2
  } else if (c >= 0xd800 && c <= 0xdbff) {
    // High surrogate — next char completes the pair, total 4 UTF-8 bytes
    L.b += 4
    L.i++
  } else {
    L.b += 3
  }
}

function peek(L: Lexer, off = 0): string {
  return L.i + off < L.len ? L.src[L.i + off]! : ''
}

function byteAt(L: Lexer, charIdx: number): number {
  // Fast path: ASCII-only prefix means char idx == byte idx
  if (L.byteTable) return L.byteTable[charIdx]!
  // Build table on first non-trivial lookup
  const t = new Uint32Array(L.len + 1)
  let b = 0
  let i = 0
  while (i < L.len) {
    t[i] = b
    const c = L.src.charCodeAt(i)
    if (c < 0x80) {
      b++
      i++
    } else if (c < 0x800) {
      b += 2
      i++
    } else if (c >= 0xd800 && c <= 0xdbff) {
      t[i + 1] = b + 2
      b += 4
      i += 2
    } else {
      b += 3
      i++
    }
  }
  t[L.len] = b
  L.byteTable = t
  return t[charIdx]!
}

function isWordChar(c: string): boolean {
  // Bash word chars: alphanumeric + various punctuation that doesn't start operators
  return (
    (c >= 'a' && c <= 'z') ||
    (c >= 'A' && c <= 'Z') ||
    (c >= '0' && c <= '9') ||
    c === '_' ||
    c === '/' ||
    c === '.' ||
    c === '-' ||
    c === '+' ||
    c === ':' ||
    c === '@' ||
    c === '%' ||
    c === ',' ||
    c === '~' ||
    c === '^' ||
    c === '?' ||
    c === '*' ||
    c === '!' ||
    c === '=' ||
    c === '[' ||
    c === ']'
  )
}

function isWordStart(c: string): boolean {
  return isWordChar(c) || c === '\\'
}

function isIdentStart(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'
}

function isIdentChar(c: string): boolean {
  return isIdentStart(c) || (c >= '0' && c <= '9')
}

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9'
}

function isHexDigit(c: string): boolean {
  return isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
}

function isBaseDigit(c: string): boolean {
  // Bash BASE#DIGITS: digits, letters, @ and _ (up to base 64)
  return isIdentChar(c) || c === '@'
}

/**
 * Unquoted heredoc delimiter chars. Bash accepts most non-metacharacters —
 * not just identifiers. Stop at whitespace, redirects, pipe/list operators,
 * and structural tokens. Allows !, -, ., +, etc. (e.g. <<!HEREDOC!).
 */
function isHeredocDelimChar(c: string): boolean {
  return (
    c !== '' &&
    c !== ' ' &&
    c !== '\t' &&
    c !== '\n' &&
    c !== '<' &&
    c !== '>' &&
    c !== '|' &&
    c !== '&' &&
    c !== ';' &&
    c !== '(' &&
    c !== ')' &&
    c !== "'" &&
    c !== '"' &&
    c !== '`' &&
    c !== '\\'
  )
}

function skipBlanks(L: Lexer): void {
  while (L.i < L.len) {
    const c = L.src[L.i]!
    if (c === ' ' || c === '\t' || c === '\r') {
      // \r is whitespace per tree-sitter-bash extras /\s/ — handles CRLF inputs
      advance(L)
    } else if (c === '\\') {
      const nx = L.src[L.i + 1]
      if (nx === '\n' || (nx === '\r' && L.src[L.i + 2] === '\n')) {
        // Line continuation — tree-sitter extras: /\\\r?\n/
        advance(L)
        advance(L)
        if (nx === '\r') advance(L)
      } else if (nx === ' ' || nx === '\t') {
        // \<space> or \<tab> — tree-sitter's _whitespace is /\\?[ \t\v]+/
        advance(L)
        advance(L)
      } else {
        break
      }
    } else {
      break
    }
  }
}

/**
 * Scan next token. Context-sensitive: `cmd` mode treats [ as operator (test
 * command start), `arg` mode treats [ as word char (glob/subscript).
 */
function nextToken(L: Lexer, ctx: 'cmd' | 'arg' = 'arg'): Token {
  skipBlanks(L)
  const start = L.b
  if (L.i >= L.len) return { type: 'EOF', value: '', start, end: start }

  const c = L.src[L.i]!
  const c1 = peek(L, 1)
  const c2 = peek(L, 2)

  if (c === '\n') {
    advance(L)
    return { type: 'NEWLINE', value: '\n', start, end: L.b }
  }

  if (c === '#') {
    const si = L.i
    while (L.i < L.len && L.src[L.i] !== '\n') advance(L)
    return {
      type: 'COMMENT',
      value: L.src.slice(si, L.i),
      start,
      end: L.b,
    }
  }

  // Multi-char operators (longest match first)
  if (c === '&' && c1 === '&') {
    advance(L)
    advance(L)
    return { type: 'OP', value: '&&', start, end: L.b }
  }
  if (c === '|' && c1 === '|') {
    advance(L)
    advance(L)
    return { type: 'OP', value: '||', start, end: L.b }
  }
  if (c === '|' && c1 === '&') {
    advance(L)
    advance(L)
    return { type: 'OP', value: '|&', start, end: L.b }
  }
  if (c === ';' && c1 === ';' && c2 === '&') {
    advance(L)
    advance(L)
    advance(L)
    return { type: 'OP', value: ';;&', start, end: L.b }
  }
  if (c === ';' && c1 === ';') {
    advance(L)
    advance(L)
    return { type: 'OP', value: ';;', start, end: L.b }
  }
  if (c === ';' && c1 === '&') {
    advance(L)
    advance(L)
    return { type: 'OP', value: ';&', start, end: L.b }
  }
  if (c === '>' && c1 === '>') {
    advance(L)
    advance(L)
    return { type: 'OP', value: '>>', start, end: L.b }
  }
  if (c === '>' && c1 === '&' && c2 === '-') {
    advance(L)
    advance(L)
    advance(L)
    return { type: 'OP', value: '>&-', start, end: L.b }
  }
  if (c === '>' && c1 === '&') {
    advance(L)
    advance(L)
    return { type: 'OP', value: '>&', start, end: L.b }
  }
  if (c === '>' && c1 === '|') {
    advance(L)
    advance(L)
    return { type: 'OP', value: '>|', start, end: L.b }
  }
  if (c === '&' && c1 === '>' && c2 === '>') {
    advance(L)
    advance(L)
    advance(L)
    return { type: 'OP', value: '&>>', start, end: L.b }
  }
  if (c === '&' && c1 === '>') {
    advance(L)
    advance(L)
    return { type: 'OP', value: '&>', start, end: L.b }
  }
  if (c === '<' && c1 === '<' && c2 === '<') {
    advance(L)
    advance(L)
    advance(L)
    return { type: 'OP', value: '<<<', start, end: L.b }
  }
  if (c === '<' && c1 === '<' && c2 === '-') {
    advance(L)
    advance(L)
    advance(L)
    return { type: 'OP', value: '<<-', start, end: L.b }
  }
  if (c === '<' && c1 === '<') {
    advance(L)
    advance(L)
    return { type: 'OP', value: '<<', start, end: L.b }
  }
  if (c === '<' && c1 === '&' && c2 === '-') {
    advance(L)
    advance(L)
    advance(L)
    return { type: 'OP', value: '<&-', start, end: L.b }
  }
  if (c === '<' && c1 === '&') {
    advance(L)
    advance(L)
    return { type: 'OP', value: '<&', start, end: L.b }
  }
  if (c === '<' && c1 === '(') {
    advance(L)
    advance(L)
    return { type: 'LT_PAREN', value: '<(', start, end: L.b }
  }
  if (c === '>' && c1 === '(') {
    advance(L)
    advance(L)
    return { type: 'GT_PAREN', value: '>(', start, end: L.b }
  }
  if (c === '(' && c1 === '(') {
    advance(L)
    advance(L)
    return { type: 'OP', value: '((', start, end: L.b }
  }
  if (c === ')' && c1 === ')') {
    advance(L)
    advance(L)
    return { type: 'OP', value: '))', start, end: L.b }
  }

  if (c === '|' || c === '&' || c === ';' || c === '>' || c === '<') {
    advance(L)
    return { type: 'OP', value: c, start, end: L.b }
  }
  if (c === '(' || c === ')') {
    advance(L)
    return { type: 'OP', value: c, start, end: L.b }
  }

  // In cmd position, [ [[ { start test/group; in arg position they're word chars
  if (ctx === 'cmd') {
    if (c === '[' && c1 === '[') {
      advance(L)
      advance(L)
      return { type: 'OP', value: '[[', start, end: L.b }
    }
    if (c === '[') {
      advance(L)
      return { type: 'OP', value: '[', start, end: L.b }
    }
    if (c === '{' && (c1 === ' ' || c1 === '\t' || c1 === '\n')) {
      advance(L)
      return { type: 'OP', value: '{', start, end: L.b }
    }
    if (c === '}') {
      advance(L)
      return { type: 'OP', value: '}', start, end: L.b }
    }
    if (c === '!' && (c1 === ' ' || c1 === '\t')) {
      advance(L)
      return { type: 'OP', value: '!', start, end: L.b }
    }
  }

  if (c === '"') {
    advance(L)
    return { type: 'DQUOTE', value: '"', start, end: L.b }
  }
  if (c === "'") {
    const si = L.i
    advance(L)
    while (L.i < L.len && L.src[L.i] !== "'") advance(L)
    if (L.i < L.len) advance(L)
    return {
      type: 'SQUOTE',
      value: L.src.slice(si, L.i),
      start,
      end: L.b,
    }
  }

  if (c === '$') {
    if (c1 === '(' && c2 === '(') {
      advance(L)
      advance(L)
      advance(L)
      return { type: 'DOLLAR_DPAREN', value: '$((', start, end: L.b }
    }
    if (c1 === '(') {
      advance(L)
      advance(L)
      return { type: 'DOLLAR_PAREN', value: '$(', start, end: L.b }
    }
    if (c1 === '{') {
      advance(L)
      advance(L)
      return { type: 'DOLLAR_BRACE', value: '${', start, end: L.b }
    }
    if (c1 === "'") {
      // ANSI-C string $'...'
      const si = L.i
      advance(L)
      advance(L)
      while (L.i < L.len && L.src[L.i] !== "'") {
        if (L.src[L.i] === '\\' && L.i + 1 < L.len) advance(L)
        advance(L)
      }
      if (L.i < L.len) advance(L)
      return {
        type: 'ANSI_C',
        value: L.src.slice(si, L.i),
        start,
        end: L.b,
      }
    }
    advance(L)
    return { type: 'DOLLAR', value: '$', start, end: L.b }
  }

  if (c === '`') {
    advance(L)
    return { type: 'BACKTICK', value: '`', start, end: L.b }
  }

  // File descriptor before redirect: digit+ immediately followed by > or <
  if (isDigit(c)) {
    let j = L.i
    while (j < L.len && isDigit(L.src[j]!)) j++
    const after = j < L.len ? L.src[j]! : ''
    if (after === '>' || after === '<') {
      const si = L.i
      while (L.i < j) advance(L)
      return {
        type: 'WORD',
        value: L.src.slice(si, L.i),
        start,
        end: L.b,
      }
    }
  }

  // Word / number
  if (isWordStart(c) || c === '{' || c === '}') {
    const si = L.i
    while (L.i < L.len) {
      const ch = L.src[L.i]!
      if (ch === '\\') {
        if (L.i + 1 >= L.len) {
          // Trailing `\` at EOF — tree-sitter excludes it from the word and
          // emits a sibling ERROR. Stop here so the word ends before `\`.
          break
        }
        // Escape next char (including \n for line continuation mid-word)
        if (L.src[L.i + 1] === '\n') {
          advance(L)
          advance(L)
          continue
        }
        advance(L)
        advance(L)
        continue
      }
      if (!isWordChar(ch) && ch !== '{' && ch !== '}') {
        break
      }
      advance(L)
    }
    if (L.i > si) {
      const v = L.src.slice(si, L.i)
      // Number: optional sign then digits only
      if (/^-?\d+$/.test(v)) {
        return { type: 'NUMBER', value: v, start, end: L.b }
      }
      return { type: 'WORD', value: v, start, end: L.b }
    }
    // Empty word (lone `\` at EOF) — fall through to single-char consumer
  }

  // Unknown char — consume as single-char word
  advance(L)
  return { type: 'WORD', value: c, start, end: L.b }
}

// ───────────────────────────── Parser ─────────────────────────────

type ParseState = {
  L: Lexer
  src: string
  srcBytes: number
  /** True when byte offsets == char indices (no multi-byte UTF-8) */
  isAscii: boolean
  nodeCount: number
  deadline: number
  aborted: boolean
  /** Depth of backtick nesting — inside `...`, ` terminates words */
  inBacktick: number
  /** When set, parseSimpleCommand stops at this token (for `[` backtrack) */
  stopToken: string | null
}

function parseSource(source: string, timeoutMs?: number): TsNode | null {
  const L = makeLexer(source)
  const srcBytes = byteLengthUtf8(source)
  const P: ParseState = {
    L,
    src: source,
    srcBytes,
    isAscii: srcBytes === source.length,
    nodeCount: 0,
    deadline: performance.now() + (timeoutMs ?? PARSE_TIMEOUT_MS),
    aborted: false,
    inBacktick: 0,
    stopToken: null,
  }
  try {
    const program = parseProgram(P)
    if (P.aborted) return null
    return program
  } catch {
    return null
  }
}

function byteLengthUtf8(s: string): number {
  let b = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) b++
    else if (c < 0x800) b += 2
    else if (c >= 0xd800 && c <= 0xdbff) {
      b += 4
      i++
    } else b += 3
  }
  return b
}

function checkBudget(P: ParseState): void {
  P.nodeCount++
  if (P.nodeCount > MAX_NODES) {
    P.aborted = true
    throw new Error('budget')
  }
  if ((P.nodeCount & 0x7f) === 0 && performance.now() > P.deadline) {
    P.aborted = true
    throw new Error('timeout')
  }
}

/** Build a node. Slices text from source by byte range via char-index lookup. */
function mk(
  P: ParseState,
  type: string,
  start: number,
  end: number,
  children: TsNode[],
): TsNode {
  checkBudget(P)
  return {
    type,
    text: sliceBytes(P, start, end),
    startIndex: start,
    endIndex: end,
    children,
  }
}

function sliceBytes(P: ParseState, startByte: number, endByte: number): string {
  if (P.isAscii) return P.src.slice(startByte, endByte)
  // Find char indices for byte offsets. Build byte table if needed.
  const L = P.L
  if (!L.byteTable) byteAt(L, 0)
  const t = L.byteTable!
  // Binary search for char index where byte offset matches
  let lo = 0
  let hi = P.src.length
  while (lo < hi) {
    const m = (lo + hi) >>> 1
    if (t[m]! < startByte) lo = m + 1
    else hi = m
  }
  const sc = lo
  lo = sc
  hi = P.src.length
  while (lo < hi) {
    const m = (lo + hi) >>> 1
    if (t[m]! < endByte) lo = m + 1
    else hi = m
  }
  return P.src.slice(sc, lo)
}

function leaf(P: ParseState, type: string, tok: Token): TsNode {
  return mk(P, type, tok.start, tok.end, [])
}

function parseProgram(P: ParseState): TsNode {
  const children: TsNode[] = []
  // Skip leading whitespace & newlines — program start is first content byte
  skipBlanks(P.L)
  while (true) {
    const save = saveLex(P.L)
    const t = nextToken(P.L, 'cmd')
    if (t.type === 'NEWLINE') {
      skipBlanks(P.L)
      continue
    }
    restoreLex(P.L, save)
    break
  }
  const progStart = P.L.b
  while (P.L.i < P.L.len) {
    const save = saveLex(P.L)
    const t = nextToken(P.L, 'cmd')
    if (t.type === 'EOF') break
    if (t.type === 'NEWLINE') continue
    if (t.type === 'COMMENT') {
      children.push(leaf(P, 'comment', t))
      continue
    }
    restoreLex(P.L, save)
    const stmts = parseStatements(P, null)
    for (const s of stmts) children.push(s)
    if (stmts.length === 0) {
      // Couldn't parse — emit ERROR and skip one token
      const errTok = nextToken(P.L, 'cmd')
      if (errTok.type === 'EOF') break
      // Stray `;;` at program level (e.g., `var=;;` outside case) — tree-sitter
      // silently elides. Keep leading `;` as ERROR (security: paste artifact).
      if (
        errTok.type === 'OP' &&
        errTok.value === ';;' &&
        children.length > 0
      ) {
        continue
      }
      children.push(mk(P, 'ERROR', errTok.start, errTok.end, []))
    }
  }
  // tree-sitter includes trailing whitespace in program extent
  const progEnd = children.length > 0 ? P.srcBytes : progStart
  return mk(P, 'program', progStart, progEnd, children)
}

/** Packed as (b << 16) | i — avoids heap alloc on every backtrack. */
type LexSave = number
function saveLex(L: Lexer): LexSave {
  return L.b * 0x10000 + L.i
}
function restoreLex(L: Lexer, s: LexSave): void {
  L.i = s & 0xffff
  L.b = s >>> 16
}

/**
 * Parse a sequence of statements separated by ; & newline. Returns a flat list
 * where ; and & are sibling leaves (NOT wrapped in 'list' — only && || get
 * that). Stops at terminator or EOF.
 */
function parseStatements(P: ParseState, terminator: string | null): TsNode[] {
  const out: TsNode[] = []
  while (true) {
    skipBlanks(P.L)
    const save = saveLex(P.L)
    const t = nextToken(P.L, 'cmd')
    if (t.type === 'EOF') {
      restoreLex(P.L, save)
      break
    }
    if (t.type === 'NEWLINE') {
      // Process pending heredocs
      if (P.L.heredocs.length > 0) {
        scanHeredocBodies(P)
      }
      continue
    }
    if (t.type === 'COMMENT') {
      out.push(leaf(P, 'comment', t))
      continue
    }
    if (terminator && t.type === 'OP' && t.value === terminator) {
      restoreLex(P.L, save)
      break
    }
    if (
      t.type === 'OP' &&
      (t.value === ')' ||
        t.value === '}' ||
        t.value === ';;' ||
        t.value === ';&' ||
        t.value === ';;&' ||
        t.value === '))' ||
        t.value === ']]' ||
        t.value === ']')
    ) {
      restoreLex(P.L, save)
      break
    }
    if (t.type === 'BACKTICK' && P.inBacktick > 0) {
      restoreLex(P.L, save)
      break
    }
    if (
      t.type === 'WORD' &&
      (t.value === 'then' ||
        t.value === 'elif' ||
        t.value === 'else' ||
        t.value === 'fi' ||
        t.value === 'do' ||
        t.value === 'done' ||
        t.value === 'esac')
    ) {
      restoreLex(P.L, save)
      break
    }
    restoreLex(P.L, save)
    const stmt = parseAndOr(P)
    if (!stmt) break
    out.push(stmt)
    // Look for separator
    skipBlanks(P.L)
    const save2 = saveLex(P.L)
    const sep = nextToken(P.L, 'cmd')
    if (sep.type === 'OP' && (sep.value === ';' || sep.value === '&')) {
      // Check if terminator follows — if so, emit separator but stop
      const save3 = saveLex(P.L)
      const after = nextToken(P.L, 'cmd')
      restoreLex(P.L, save3)
      out.push(leaf(P, sep.value, sep))
      if (
        after.type === 'EOF' ||
        (after.type === 'OP' &&
          (after.value === ')' ||
            after.value === '}' ||
            after.value === ';;' ||
            after.value === ';&' ||
            after.value === ';;&')) ||
        (after.type === 'WORD' &&
          (after.value === 'then' ||
            after.value === 'elif' ||
            after.value === 'else' ||
            after.value === 'fi' ||
            after.value === 'do' ||
            after.value === 'done' ||
            after.value === 'esac'))
      ) {
        // Trailing separator — don't include it at program level unless
        // there's content after. But at inner levels we keep it.
        continue
      }
    } else if (sep.type === 'NEWLINE') {
      if (P.L.heredocs.length > 0) {
        scanHeredocBodies(P)
      }
      continue
    } else {
      restoreLex(P.L, save2)
    }
  }
  // Trim trailing separator if at program level
  return out
}

/**
 * Parse pipeline chains joined by && ||. Left-associative nesting.
 * tree-sitter quirk: trailing redirect on the last pipeline wraps the ENTIRE
 * list in a redirected_statement — `a > x && b > y` becomes
 * redirected_statement(list(redirected_statement(a,>x), &&, b), >y).
 */
function parseAndOr(P: ParseState): TsNode | null {
  let left = parsePipeline(P)
  if (!left) return null
  while (true) {
    const save = saveLex(P.L)
    const t = nextToken(P.L, 'cmd')
    if (t.type === 'OP' && (t.value === '&&' || t.value === '||')) {
      const op = leaf(P, t.value, t)
      skipNewlines(P)
      const right = parsePipeline(P)
      if (!right) {
        left = mk(P, 'list', left.startIndex, op.endIndex, [left, op])
        break
      }
      // If right is a redirected_statement, hoist its redirects to wrap the list.
      if (right.type === 'redirected_statement' && right.children.length >= 2) {
        const inner = right.children[0]!
        const redirs = right.children.slice(1)
        const listNode = mk(P, 'list', left.startIndex, inner.endIndex, [
          left,
          op,
          inner,
        ])
        const lastR = redirs[redirs.length - 1]!
        left = mk(
          P,
          'redirected_statement',
          listNode.startIndex,
          lastR.endIndex,
          [listNode, ...redirs],
        )
      } else {
        left = mk(P, 'list', left.startIndex, right.endIndex, [left, op, right])
      }
    } else {
      restoreLex(P.L, save)
      break
    }
  }
  return left
}

function skipNewlines(P: ParseState): void {
  while (true) {
    const save = saveLex(P.L)
    const t = nextToken(P.L, 'cmd')
    if (t.type !== 'NEWLINE') {
      restoreLex(P.L, save)
      break
    }
  }
}

/**
 * Parse commands joined by | or |&. Flat children with operator leaves.
 * tree-sitter quirk: `a | b 2>nul | c` hoists the redirect on `b` to wrap
 * the preceding pipeline fragment — pipeline(redirected_statement(
 * pipeline(a,|,b), 2>nul), |, c).
 */
function parsePipeline(P: ParseState): TsNode | null {
  let first = parseCommand(P)
  if (!first) return null
  const parts: TsNode[] = [first]
  while (true) {
    const save = saveLex(P.L)
    const t = nextToken(P.L, 'cmd')
    if (t.type === 'OP' && (t.value === '|' || t.value === '|&')) {
      const op = leaf(P, t.value, t)
      skipNewlines(P)
      const next = parseCommand(P)
      if (!next) {
        parts.push(op)
        break
      }
      // Hoist trailing redirect on `next` to wrap current pipeline fragment
      if (
        next.type === 'redirected_statement' &&
        next.children.length >= 2 &&
        parts.length >= 1
      ) {
        const inner = next.children[0]!
        const redirs = next.children.slice(1)
        // Wrap existing parts + op + inner as a pipeline
        const pipeKids = [...parts, op, inner]
        const pipeNode = mk(
          P,
          'pipeline',
          pipeKids[0]!.startIndex,
          inner.endIndex,
          pipeKids,
        )
        const lastR = redirs[redirs.length - 1]!
        const wrapped = mk(
          P,
          'redirected_statement',
          pipeNode.startIndex,
          lastR.endIndex,
          [pipeNode, ...redirs],
        )
        parts.length = 0
        parts.push(wrapped)
        first = wrapped
        continue
      }
      parts.push(op, next)
    } else {
      restoreLex(P.L, save)
      break
    }
  }
  if (parts.length === 1) return parts[0]!
  const last = parts[parts.length - 1]!
  return mk(P, 'pipeline', parts[0]!.startIndex, last.endIndex, parts)
}

/** Parse a single command: simple, compound, or control structure. */
function parseCommand(P: ParseState): TsNode | null {
  skipBlanks(P.L)
  const save = saveLex(P.L)
  const t = nextToken(P.L, 'cmd')

  if (t.type === 'EOF') {
    restoreLex(P.L, save)
    return null
  }

  // Negation — tree-sitter wraps just the command, redirects go outside.
  // `! cmd > out` → redirected_statement(negated_command(!, cmd), >out)
  if (t.type === 'OP' && t.value === '!') {
    const bang = leaf(P, '!', t)
    const inner = parseCommand(P)
    if (!inner) {
      restoreLex(P.L, save)
      return null
    }
    // If inner is a redirected_statement, hoist redirects outside negation
    if (inner.type === 'redirected_statement' && inner.children.length >= 2) {
      const cmd = inner.children[0]!
      const redirs = inner.children.slice(1)
      const neg = mk(P, 'negated_command', bang.startIndex, cmd.endIndex, [
        bang,
        cmd,
      ])
      const lastR = redirs[redirs.length - 1]!
      return mk(P, 'redirected_statement', neg.startIndex, lastR.endIndex, [
        neg,
        ...redirs,
      ])
    }
    return mk(P, 'negated_command', bang.startIndex, inner.endIndex, [
      bang,
      inner,
    ])
  }

  if (t.type === 'OP' && t.value === '(') {
    const open = leaf(P, '(', t)
    const body = parseStatements(P, ')')
    const closeTok = nextToken(P.L, 'cmd')
    const close =
      closeTok.type === 'OP' && closeTok.value === ')'
        ? leaf(P, ')', closeTok)
        : mk(P, ')', open.endIndex, open.endIndex, [])
    const node = mk(P, 'subshell', open.startIndex, close.endIndex, [
      open,
      ...body,
      close,
    ])
    return maybeRedirect(P, node)
  }

  if (t.type === 'OP' && t.value === '((') {
    const open = leaf(P, '((', t)
    const exprs = parseArithCommaList(P, '))', 'var')
    const closeTok = nextToken(P.L, 'cmd')
    const close =
      closeTok.value === '))'
        ? leaf(P, '))', closeTok)
        : mk(P, '))', open.endIndex, open.endIndex, [])
    return mk(P, 'compound_statement', open.startIndex, close.endIndex, [
      open,
      ...exprs,
      close,
    ])
  }

  if (t.type === 'OP' && t.value === '{') {
    const open = leaf(P, '{', t)
    const body = parseStatements(P, '}')
    const closeTok = nextToken(P.L, 'cmd')
    const close =
      closeTok.type === 'OP' && closeTok.value === '}'
        ? leaf(P, '}', closeTok)
        : mk(P, '}', open.endIndex, open.endIndex, [])
    const node = mk(P, 'compound_statement', open.startIndex, close.endIndex, [
      open,
      ...body,
      close,
    ])
    return maybeRedirect(P, node)
  }

  if (t.type === 'OP' && (t.value === '[' || t.value === '[[')) {
    const open = leaf(P, t.value, t)
    const closer = t.value === '[' ? ']' : ']]'
    // Grammar: `[` can contain choice(_expression, redirected_statement).
    // Try _expression first; if we don't reach `]`, backtrack and parse as
    // redirected_statement (handles `[ ! cmd -v go &>/dev/null ]`).
    const exprSave = saveLex(P.L)
    let expr = parseTestExpr(P, closer)
    skipBlanks(P.L)
    if (t.value === '[' && peek(P.L) !== ']') {
      // Expression parse didn't reach `]` — try as redirected_statement.
      // Thread `]` stop-token so parseSimpleCommand doesn't eat it as arg.
      restoreLex(P.L, exprSave)
      const prevStop = P.stopToken
      P.stopToken = ']'
      const rstmt = parseCommand(P)
      P.stopToken = prevStop
      if (rstmt && rstmt.type === 'redirected_statement') {
        expr = rstmt
      } else {
        // Neither worked — restore and keep the expression result
        restoreLex(P.L, exprSave)
        expr = parseTestExpr(P, closer)
      }
      skipBlanks(P.L)
    }
    const closeTok = nextToken(P.L, 'arg')
    let close: TsNode
    if (closeTok.value === closer) {
      close = leaf(P, closer, closeTok)
    } else {
      close = mk(P, closer, open.endIndex, open.endIndex, [])
    }
    const kids = expr ? [open, expr, close] : [open, close]
    return mk(P, 'test_command', open.startIndex, close.endIndex, kids)
  }

  if (t.type === 'WORD') {
    if (t.value === 'if') return maybeRedirect(P, parseIf(P, t), true)
    if (t.value === 'while' || t.value === 'until')
      return maybeRedirect(P, parseWhile(P, t), true)
    if (t.value === 'for') return maybeRedirect(P, parseFor(P, t), true)
    if (t.value === 'select') return maybeRedirect(P, parseFor(P, t), true)
    if (t.value === 'case') return maybeRedirect(P, parseCase(P, t), true)
    if (t.value === 'function') return parseFunction(P, t)
    if (DECL_KEYWORDS.has(t.value))
      return maybeRedirect(P, parseDeclaration(P, t))
    if (t.value === 'unset' || t.value === 'unsetenv') {
      return maybeRedirect(P, parseUnset(P, t))
    }
  }

  restoreLex(P.L, save)
  return parseSimpleCommand(P)
}

/**
 * Parse a simple command: [assignment]* word [arg|redirect]*
 * Returns variable_assignment if only one assignment and no command.
 */
function parseSimpleCommand(P: ParseState): TsNode | null {
  const start = P.L.b
  const assignments: TsNode[] = []
  const preRedirects: TsNode[] = []

  while (true) {
    skipBlanks(P.L)
    const a = tryParseAssignment(P)
    if (a) {
      assignments.push(a)
      continue
    }
    const r = tryParseRedirect(P)
    if (r) {
      preRedirects.push(r)
      continue
    }
    break
  }

  skipBlanks(P.L)
  const save = saveLex(P.L)
  const nameTok = nextToken(P.L, 'cmd')
  if (
    nameTok.type === 'EOF' ||
    nameTok.type === 'NEWLINE' ||
    nameTok.type === 'COMMENT' ||
    (nameTok.type === 'OP' &&
      nameTok.value !== '{' &&
      nameTok.value !== '[' &&
      nameTok.value !== '[[') ||
    (nameTok.type === 'WORD' &&
      SHELL_KEYWORDS.has(nameTok.value) &&
      nameTok.value !== 'in')
  ) {
    restoreLex(P.L, save)
    // No command — standalone assignment(s) or redirect
    if (assignments.length === 1 && preRedirects.length === 0) {
      return assignments[0]!
    }
    if (preRedirects.length > 0 && assignments.length === 0) {
      // Bare redirect → redirected_statement with just file_redirect children
      const last = preRedirects[preRedirects.length - 1]!
      return mk(
        P,
        'redirected_statement',
        preRedirects[0]!.startIndex,
        last.endIndex,
        preRedirects,
      )
    }
    if (assignments.length > 1 && preRedirects.length === 0) {
      // `A=1 B=2` with no command → variable_assignments (plural)
      const last = assignments[assignments.length - 1]!
      return mk(
        P,
        'variable_assignments',
        assignments[0]!.startIndex,
        last.endIndex,
        assignments,
      )
    }
    if (assignments.length > 0 || preRedirects.length > 0) {
      const all = [...assignments, ...preRedirects]
      const last = all[all.length - 1]!
      return mk(P, 'command', start, last.endIndex, all)
    }
    return null
  }
  restoreLex(P.L, save)

  // Check for function definition: name() { ... }
  const fnSave = saveLex(P.L)
  const nm = parseWord(P, 'cmd')
  if (nm && nm.type === 'word') {
    skipBlanks(P.L)
    if (peek(P.L) === '(' && peek(P.L, 1) === ')') {
      const oTok = nextToken(P.L, 'cmd')
      const cTok = nextToken(P.L, 'cmd')
      const oParen = leaf(P, '(', oTok)
      const cParen = leaf(P, ')', cTok)
      skipBlanks(P.L)
      skipNewlines(P)
      const body = parseCommand(P)
      if (body) {
        // If body is redirected_statement(compound_statement, file_redirect...),
        // hoist redirects to function_definition level per tree-sitter grammar
        let bodyKids: TsNode[] = [body]
        if (
          body.type === 'redirected_statement' &&
          body.children.length >= 2 &&
          body.children[0]!.type === 'compound_statement'
        ) {
          bodyKids = body.children
        }
        const last = bodyKids[bodyKids.length - 1]!
        return mk(P, 'function_definition', nm.startIndex, last.endIndex, [
          nm,
          oParen,
          cParen,
          ...bodyKids,
        ])
      }
    }
  }
  restoreLex(P.L, fnSave)

  const nameArg = parseWord(P, 'cmd')
  if (!nameArg) {
    if (assignments.length === 1) return assignments[0]!
    return null
  }

  const cmdName = mk(P, 'command_name', nameArg.startIndex, nameArg.endIndex, [
    nameArg,
  ])

  const args: TsNode[] = []
  const redirects: TsNode[] = []
  let heredocRedirect: TsNode | null = null

  while (true) {
    skipBlanks(P.L)
    // Post-command redirects are greedy (repeat1 $._literal) — once a redirect
    // appears after command_name, subsequent literals attach to it per grammar's
    // prec.left. `grep 2>/dev/null -q foo` → file_redirect eats `-q foo`.
    // Args parsed BEFORE the first redirect still go to command (cat a b > out).
    const r = tryParseRedirect(P, true)
    if (r) {
      if (r.type === 'heredoc_redirect') {
        heredocRedirect = r
      } else if (r.type === 'herestring_redirect') {
        args.push(r)
      } else {
        redirects.push(r)
      }
      continue
    }
    // Once a file_redirect has been seen, command args are done — grammar's
    // command rule doesn't allow file_redirect in its post-name choice, so
    // anything after belongs to redirected_statement's file_redirect children.
    if (redirects.length > 0) break
    // `[` test_command backtrack — stop at `]` so outer handler can consume it
    if (P.stopToken === ']' && peek(P.L) === ']') break
    const save2 = saveLex(P.L)
    const pk = nextToken(P.L, 'arg')
    if (
      pk.type === 'EOF' ||
      pk.type === 'NEWLINE' ||
      pk.type === 'COMMENT' ||
      (pk.type === 'OP' &&
        (pk.value === '|' ||
          pk.value === '|&' ||
          pk.value === '&&' ||
          pk.value === '||' ||
          pk.value === ';' ||
          pk.value === ';;' ||
          pk.value === ';&' ||
          pk.value === ';;&' ||
          pk.value === '&' ||
          pk.value === ')' ||
          pk.value === '}' ||
          pk.value === '))'))
    ) {
      restoreLex(P.L, save2)
      break
    }
    restoreLex(P.L, save2)
    const arg = parseWord(P, 'arg')
    if (!arg) {
      // Lone `(` in arg position — tree-sitter parses this as subshell arg
      // e.g., `echo =(cmd)` → command has ERROR(=), subshell(cmd) as args
      if (peek(P.L) === '(') {
        const oTok = nextToken(P.L, 'cmd')
        const open = leaf(P, '(', oTok)
        const body = parseStatements(P, ')')
        const cTok = nextToken(P.L, 'cmd')
        const close =
          cTok.type === 'OP' && cTok.value === ')'
            ? leaf(P, ')', cTok)
            : mk(P, ')', open.endIndex, open.endIndex, [])
        args.push(
          mk(P, 'subshell', open.startIndex, close.endIndex, [
            open,
            ...body,
            close,
          ]),
        )
        continue
      }
      break
    }
    // Lone `=` in arg position is a parse error in bash — tree-sitter wraps
    // it in ERROR for recovery. Happens in `echo =(cmd)` (zsh process-sub).
    if (arg.type === 'word' && arg.text === '=') {
      args.push(mk(P, 'ERROR', arg.startIndex, arg.endIndex, [arg]))
      continue
    }
    // Word immediately followed by `(` (no whitespace) is a parse error —
    // bash doesn't allow glob-then-subshell adjacency. tree-sitter wraps the
    // word in ERROR. Catches zsh glob qualifiers like `*.(e:'cmd':)`.
    if (
      (arg.type === 'word' || arg.type === 'concatenation') &&
      peek(P.L) === '(' &&
      P.L.b === arg.endIndex
    ) {
      args.push(mk(P, 'ERROR', arg.startIndex, arg.endIndex, [arg]))
      continue
    }
    args.push(arg)
  }

  // preRedirects (e.g., `2>&1 cat`, `<<<str cmd`) go INSIDE the command node
  // before command_name per tree-sitter grammar, not in redirected_statement
  const cmdChildren = [...assignments, ...preRedirects, cmdName, ...args]
  const cmdEnd =
    cmdChildren.length > 0
      ? cmdChildren[cmdChildren.length - 1]!.endIndex
      : cmdName.endIndex
  const cmdStart = cmdChildren[0]!.startIndex
  const cmd = mk(P, 'command', cmdStart, cmdEnd, cmdChildren)

  if (heredocRedirect) {
    // Scan heredoc body now
    scanHeredocBodies(P)
    const hd = P.L.heredocs.shift()
    if (hd && heredocRedirect.children.length >= 2) {
      const bodyNode = mk(
        P,
        'heredoc_body',
        hd.bodyStart,
        hd.bodyEnd,
        hd.quoted ? [] : parseHeredocBodyContent(P, hd.bodyStart, hd.bodyEnd),
      )
      const endNode = mk(P, 'heredoc_end', hd.endStart, hd.endEnd, [])
      heredocRedirect.children.push(bodyNode, endNode)
      heredocRedirect.endIndex = hd.endEnd
      heredocRedirect.text = sliceBytes(
        P,
        heredocRedirect.startIndex,
        hd.endEnd,
      )
    }
    const allR = [...preRedirects, heredocRedirect, ...redirects]
    const rStart =
      preRedirects.length > 0
        ? Math.min(cmd.startIndex, preRedirects[0]!.startIndex)
        : cmd.startIndex
    return mk(P, 'redirected_statement', rStart, heredocRedirect.endIndex, [
      cmd,
      ...allR,
    ])
  }

  if (redirects.length > 0) {
    const last = redirects[redirects.length - 1]!
    return mk(P, 'redirected_statement', cmd.startIndex, last.endIndex, [
      cmd,
      ...redirects,
    ])
  }

  return cmd
}

function maybeRedirect(
  P: ParseState,
  node: TsNode,
  allowHerestring = false,
): TsNode {
  const redirects: TsNode[] = []
  while (true) {
    skipBlanks(P.L)
    const save = saveLex(P.L)
    const r = tryParseRedirect(P)
    if (!r) break
    if (r.type === 'herestring_redirect' && !allowHerestring) {
      restoreLex(P.L, save)
      break
    }
    redirects.push(r)
  }
  if (redirects.length === 0) return node
  const last = redirects[redirects.length - 1]!
  return mk(P, 'redirected_statement', node.startIndex, last.endIndex, [
    node,
    ...redirects,
  ])
}

function tryParseAssignment(P: ParseState): TsNode | null {
  const save = saveLex(P.L)
  skipBlanks(P.L)
  const startB = P.L.b
  // Must start with identifier
  if (!isIdentStart(peek(P.L))) {
    restoreLex(P.L, save)
    return null
  }
  while (isIdentChar(peek(P.L))) advance(P.L)
  const nameEnd = P.L.b
  // Optional subscript
  let subEnd = nameEnd
  if (peek(P.L) === '[') {
    advance(P.L)
    let depth = 1
    while (P.L.i < P.L.len && depth > 0) {
      const c = peek(P.L)
      if (c === '[') depth++
      else if (c === ']') depth--
      advance(P.L)
    }
    subEnd = P.L.b
  }
  const c = peek(P.L)
  const c1 = peek(P.L, 1)
  let op: string
  if (c === '=' && c1 !== '=') {
    op = '='
  } else if (c === '+' && c1 === '=') {
    op = '+='
  } else {
    restoreLex(P.L, save)
    return null
  }
  const nameNode = mk(P, 'variable_name', startB, nameEnd, [])
  // Subscript handling: wrap in subscript node if present
  let lhs: TsNode = nameNode
  if (subEnd > nameEnd) {
    const brOpen = mk(P, '[', nameEnd, nameEnd + 1, [])
    const idx = parseSubscriptIndex(P, nameEnd + 1, subEnd - 1)
    const brClose = mk(P, ']', subEnd - 1, subEnd, [])
    lhs = mk(P, 'subscript', startB, subEnd, [nameNode, brOpen, idx, brClose])
  }
  const opStart = P.L.b
  advance(P.L)
  if (op === '+=') advance(P.L)
  const opEnd = P.L.b
  const opNode = mk(P, op, opStart, opEnd, [])
  let val: TsNode | null = null
  if (peek(P.L) === '(') {
    // Array
    const aoTok = nextToken(P.L, 'cmd')
    const aOpen = leaf(P, '(', aoTok)
    const elems: TsNode[] = [aOpen]
    while (true) {
      skipBlanks(P.L)
      if (peek(P.L) === ')') break
      const e = parseWord(P, 'arg')
      if (!e) break
      elems.push(e)
    }
    const acTok = nextToken(P.L, 'cmd')
    const aClose =
      acTok.value === ')'
        ? leaf(P, ')', acTok)
        : mk(P, ')', aOpen.endIndex, aOpen.endIndex, [])
    elems.push(aClose)
    val = mk(P, 'array', aOpen.startIndex, aClose.endIndex, elems)
  } else {
    const c2 = peek(P.L)
    if (
      c2 &&
      c2 !== ' ' &&
      c2 !== '\t' &&
      c2 !== '\n' &&
      c2 !== ';' &&
      c2 !== '&' &&
      c2 !== '|' &&
      c2 !== ')' &&
      c2 !== '}'
    ) {
      val = parseWord(P, 'arg')
    }
  }
  const kids = val ? [lhs, opNode, val] : [lhs, opNode]
  const end = val ? val.endIndex : opEnd
  return mk(P, 'variable_assignment', startB, end, kids)
}

/**
 * Parse subscript index content. Parsed arithmetically per tree-sitter grammar:
 * `${a[1+2]}` → binary_expression; `${a[++i]}` → unary_expression(word);
 * `${a[(($n+1))]}` → compound_statement(binary_expression). Falls back to
 * simple patterns (@, *) as word.
 */
function parseSubscriptIndexInline(P: ParseState): TsNode | null {
  skipBlanks(P.L)
  const c = peek(P.L)
  // @ or * alone → word (associative array all-keys)
  if ((c === '@' || c === '*') && peek(P.L, 1) === ']') {
    const s = P.L.b
    advance(P.L)
    return mk(P, 'word', s, P.L.b, [])
  }
  // ((expr)) → compound_statement wrapping the inner arithmetic
  if (c === '(' && peek(P.L, 1) === '(') {
    const oStart = P.L.b
    advance(P.L)
    advance(P.L)
    const open = mk(P, '((', oStart, P.L.b, [])
    const inner = parseArithExpr(P, '))', 'var')
    skipBlanks(P.L)
    let close: TsNode
    if (peek(P.L) === ')' && peek(P.L, 1) === ')') {
      const cs = P.L.b
      advance(P.L)
      advance(P.L)
      close = mk(P, '))', cs, P.L.b, [])
    } else {
      close = mk(P, '))', P.L.b, P.L.b, [])
    }
    const kids = inner ? [open, inner, close] : [open, close]
    return mk(P, 'compound_statement', open.startIndex, close.endIndex, kids)
  }
  // Arithmetic — but bare identifiers in subscript use 'word' mode per
  // tree-sitter (${words[++counter]} → unary_expression(word)).
  return parseArithExpr(P, ']', 'word')
}

/** Legacy byte-range subscript index parser — kept for callers that pre-scan. */
function parseSubscriptIndex(
  P: ParseState,
  startB: number,
  endB: number,
): TsNode {
  const text = sliceBytes(P, startB, endB)
  if (/^\d+$/.test(text)) return mk(P, 'number', startB, endB, [])
  const m = /^\$([a-zA-Z_]\w*)$/.exec(text)
  if (m) {
    const dollar = mk(P, '$', startB, startB + 1, [])
    const vn = mk(P, 'variable_name', startB + 1, endB, [])
    return mk(P, 'simple_expansion', startB, endB, [dollar, vn])
  }
  if (text.length === 2 && text[0] === '$' && SPECIAL_VARS.has(text[1]!)) {
    const dollar = mk(P, '$', startB, startB + 1, [])
    const vn = mk(P, 'special_variable_name', startB + 1, endB, [])
    return mk(P, 'simple_expansion', startB, endB, [dollar, vn])
  }
  return mk(P, 'word', startB, endB, [])
}

/**
 * Can the current position start a redirect destination literal?
 * Returns false at redirect ops, terminators, or file-descriptor-prefixed ops
 * so file_redirect's repeat1($._literal) stops at the right boundary.
 */
function isRedirectLiteralStart(P: ParseState): boolean {
  const c = peek(P.L)
  if (c === '' || c === '\n') return false
  // Shell terminators and operators
  if (c === '|' || c === '&' || c === ';' || c === '(' || c === ')')
    return false
  // Redirect operators (< > with any suffix; <( >( handled by caller)
  if (c === '<' || c === '>') {
    // <( >( are process substitutions — those ARE literals
    return peek(P.L, 1) === '('
  }
  // N< N> file descriptor prefix — starts a new redirect, not a literal
  if (isDigit(c)) {
    let j = P.L.i
    while (j < P.L.len && isDigit(P.L.src[j]!)) j++
    const after = j < P.L.len ? P.L.src[j]! : ''
    if (after === '>' || after === '<') return false
  }
  // `}` only terminates if we're in a context where it's a closer — but
  // file_redirect sees `}` as word char (e.g., `>$HOME}` is valid path char).
  // Actually `}` at top level terminates compound_statement — need to stop.
  if (c === '}') return false
  // Test command closer — when parseSimpleCommand is called from `[` context,
  // `]` must terminate so parseCommand can return and `[` handler consume it.
  if (P.stopToken === ']' && c === ']') return false
  return true
}

/**
 * Parse a redirect operator + destination(s).
 * @param greedy When true, file_redirect consumes repeat1($._literal) per
 *   grammar's prec.left — `cmd >f a b c` attaches `a b c` to the redirect.
 *   When false (preRedirect context), takes only 1 destination because
 *   command's dynamic precedence beats redirected_statement's prec(-1).
 */
function tryParseRedirect(P: ParseState, greedy = false): TsNode | null {
  const save = saveLex(P.L)
  skipBlanks(P.L)
  // File descriptor prefix?
  let fd: TsNode | null = null
  if (isDigit(peek(P.L))) {
    const startB = P.L.b
    let j = P.L.i
    while (j < P.L.len && isDigit(P.L.src[j]!)) j++
    const after = j < P.L.len ? P.L.src[j]! : ''
    if (after === '>' || after === '<') {
      while (P.L.i < j) advance(P.L)
      fd = mk(P, 'file_descriptor', startB, P.L.b, [])
    }
  }
  const t = nextToken(P.L, 'arg')
  if (t.type !== 'OP') {
    restoreLex(P.L, save)
    return null
  }
  const v = t.value
  if (v === '<<<') {
    const op = leaf(P, '<<<', t)
    skipBlanks(P.L)
    const target = parseWord(P, 'arg')
    const end = target ? target.endIndex : op.endIndex
    const kids = target ? [op, target] : [op]
    return mk(
      P,
      'herestring_redirect',
      fd ? fd.startIndex : op.startIndex,
      end,
      fd ? [fd, ...kids] : kids,
    )
  }
  if (v === '<<' || v === '<<-') {
    const op = leaf(P, v, t)
    // Heredoc start — delimiter word (may be quoted)
    skipBlanks(P.L)
    const dStart = P.L.b
    let quoted = false
    let delim = ''
    const dc = peek(P.L)
    if (dc === "'" || dc === '"') {
      quoted = true
      advance(P.L)
      while (P.L.i < P.L.len && peek(P.L) !== dc) {
        delim += peek(P.L)
        advance(P.L)
      }
      if (P.L.i < P.L.len) advance(P.L)
    } else if (dc === '\\') {
      // Backslash-escaped delimiter: \X — exactly one escaped char, body is
      // quoted (literal). Covers <<\EOF <<\' <<\\ etc.
      quoted = true
      advance(P.L)
      if (P.L.i < P.L.len && peek(P.L) !== '\n') {
        delim += peek(P.L)
        advance(P.L)
      }
      // May be followed by more ident chars (e.g. <<\EOF → delim "EOF")
      while (P.L.i < P.L.len && isIdentChar(peek(P.L))) {
        delim += peek(P.L)
        advance(P.L)
      }
    } else {
      // Unquoted delimiter: bash accepts most non-metacharacters (not just
      // identifiers). Allow !, -, ., etc. — stop at shell metachars.
      while (P.L.i < P.L.len && isHeredocDelimChar(peek(P.L))) {
        delim += peek(P.L)
        advance(P.L)
      }
    }
    const dEnd = P.L.b
    const startNode = mk(P, 'heredoc_start', dStart, dEnd, [])
    // Register pending heredoc — body scanned at next newline
    P.L.heredocs.push({
      delim,
      stripTabs: v === '<<-',
      quoted,
      bodyStart: 0,
      bodyEnd: 0,
      endStart: 0,
      endEnd: 0,
    })
    const kids = fd ? [fd, op, startNode] : [op, startNode]
    const startIdx = fd ? fd.startIndex : op.startIndex
    // SECURITY: tree-sitter nests any pipeline/list/file_redirect appearing
    // between heredoc_start and the newline as a CHILD of heredoc_redirect.
    // `ls <<'EOF' | rm -rf /tmp/evil` must not silently drop the rm. Parse
    // trailing words and file_redirects properly (ast.ts walkHeredocRedirect
    // fails closed on any unrecognized child via tooComplex). Pipeline / list
    // operators (| && || ;) are structurally complex — emit ERROR so the same
    // fail-closed path rejects them.
    while (true) {
      skipBlanks(P.L)
      const tc = peek(P.L)
      if (tc === '\n' || tc === '' || P.L.i >= P.L.len) break
      // File redirect after delimiter: cat <<EOF > out.txt
      if (tc === '>' || tc === '<' || isDigit(tc)) {
        const rSave = saveLex(P.L)
        const r = tryParseRedirect(P)
        if (r && r.type === 'file_redirect') {
          kids.push(r)
          continue
        }
        restoreLex(P.L, rSave)
      }
      // Pipeline after heredoc_start: `one <<EOF | grep two` — tree-sitter
      // nests the pipeline as a child of heredoc_redirect. ast.ts
      // walkHeredocRedirect fails closed on pipeline/command via tooComplex.
      if (tc === '|' && peek(P.L, 1) !== '|') {
        advance(P.L)
        skipBlanks(P.L)
        const pipeCmds: TsNode[] = []
        while (true) {
          const cmd = parseCommand(P)
          if (!cmd) break
          pipeCmds.push(cmd)
          skipBlanks(P.L)
          if (peek(P.L) === '|' && peek(P.L, 1) !== '|') {
            const ps = P.L.b
            advance(P.L)
            pipeCmds.push(mk(P, '|', ps, P.L.b, []))
            skipBlanks(P.L)
            continue
          }
          break
        }
        if (pipeCmds.length > 0) {
          const pl = pipeCmds[pipeCmds.length - 1]!
          // tree-sitter always wraps in pipeline after `|`, even single command
          kids.push(
            mk(P, 'pipeline', pipeCmds[0]!.startIndex, pl.endIndex, pipeCmds),
          )
        }
        continue
      }
      // && / || after heredoc_start: `cat <<-EOF || die "..."` — tree-sitter
      // nests just the RHS command (not a list) as a child of heredoc_redirect.
      if (
        (tc === '&' && peek(P.L, 1) === '&') ||
        (tc === '|' && peek(P.L, 1) === '|')
      ) {
        advance(P.L)
        advance(P.L)
        skipBlanks(P.L)
        const rhs = parseCommand(P)
        if (rhs) kids.push(rhs)
        continue
      }
      // Terminator / unhandled metachar — consume rest of line as ERROR so
      // ast.ts rejects it. Covers ; & ( )
      if (tc === '&' || tc === ';' || tc === '(' || tc === ')') {
        const eStart = P.L.b
        while (P.L.i < P.L.len && peek(P.L) !== '\n') advance(P.L)
        kids.push(mk(P, 'ERROR', eStart, P.L.b, []))
        break
      }
      // Trailing word argument: newins <<-EOF - org.freedesktop.service
      const w = parseWord(P, 'arg')
      if (w) {
        kids.push(w)
        continue
      }
      // Unrecognized — consume rest of line as ERROR
      const eStart = P.L.b
      while (P.L.i < P.L.len && peek(P.L) !== '\n') advance(P.L)
      if (P.L.b > eStart) kids.push(mk(P, 'ERROR', eStart, P.L.b, []))
      break
    }
    return mk(P, 'heredoc_redirect', startIdx, P.L.b, kids)
  }
  // Close-fd variants: `<&-` `>&-` have OPTIONAL destination (0 or 1)
  if (v === '<&-' || v === '>&-') {
    const op = leaf(P, v, t)
    const kids: TsNode[] = []
    if (fd) kids.push(fd)
    kids.push(op)
    // Optional single destination — only consume if next is a literal
    skipBlanks(P.L)
    const dSave = saveLex(P.L)
    const dest = isRedirectLiteralStart(P) ? parseWord(P, 'arg') : null
    if (dest) {
      kids.push(dest)
    } else {
      restoreLex(P.L, dSave)
    }
    const startIdx = fd ? fd.startIndex : op.startIndex
    const end = dest ? dest.endIndex : op.endIndex
    return mk(P, 'file_redirect', startIdx, end, kids)
  }
  if (
    v === '>' ||
    v === '>>' ||
    v === '>&' ||
    v === '>|' ||
    v === '&>' ||
    v === '&>>' ||
    v === '<' ||
    v === '<&'
  ) {
    const op = leaf(P, v, t)
    const kids: TsNode[] = []
    if (fd) kids.push(fd)
    kids.push(op)
    // Grammar: destination is repeat1($._literal) — greedily consume literals
    // until a non-literal (redirect op, terminator, etc). tree-sitter's
    // prec.left makes `cmd >f a b c` attach `a b c` to the file_redirect,
    // NOT to the command. Structural quirk but required for corpus parity.
    // In preRedirect context (greedy=false), take only 1 literal because
    // command's dynamic precedence beats redirected_statement's prec(-1).
    let end = op.endIndex
    let taken = 0
    while (true) {
      skipBlanks(P.L)
      if (!isRedirectLiteralStart(P)) break
      if (!greedy && taken >= 1) break
      const tc = peek(P.L)
      const tc1 = peek(P.L, 1)
      let target: TsNode | null = null
      if ((tc === '<' || tc === '>') && tc1 === '(') {
        target = parseProcessSub(P)
      } else {
        target = parseWord(P, 'arg')
      }
      if (!target) break
      kids.push(target)
      end = target.endIndex
      taken++
    }
    const startIdx = fd ? fd.startIndex : op.startIndex
    return mk(P, 'file_redirect', startIdx, end, kids)
  }
  restoreLex(P.L, save)
  return null
}

function parseProcessSub(P: ParseState): TsNode | null {
  const c = peek(P.L)
  if ((c !== '<' && c !== '>') || peek(P.L, 1) !== '(') return null
  const start = P.L.b
  advance(P.L)
  advance(P.L)
  const open = mk(P, c + '(', start, P.L.b, [])
  const body = parseStatements(P, ')')
  skipBlanks(P.L)
  let close: TsNode
  if (peek(P.L) === ')') {
    const cs = P.L.b
    advance(P.L)
    close = mk(P, ')', cs, P.L.b, [])
  } else {
    close = mk(P, ')', P.L.b, P.L.b, [])
  }
  return mk(P, 'process_substitution', start, close.endIndex, [
    open,
    ...body,
    close,
  ])
}

function scanHeredocBodies(P: ParseState): void {
  // Skip to newline if not already there
  while (P.L.i < P.L.len && P.L.src[P.L.i] !== '\n') advance(P.L)
  if (P.L.i < P.L.len) advance(P.L)
  for (const hd of P.L.heredocs) {
    hd.bodyStart = P.L.b
    const delimLen = hd.delim.length
    while (P.L.i < P.L.len) {
      const lineStart = P.L.i
      const lineStartB = P.L.b
      // Skip leading tabs if <<-
      let checkI = lineStart
      if (hd.stripTabs) {
        while (checkI < P.L.len && P.L.src[checkI] === '\t') checkI++
      }
      // Check if this line is the delimiter
      if (
        P.L.src.startsWith(hd.delim, checkI) &&
        (checkI + delimLen >= P.L.len ||
          P.L.src[checkI + delimLen] === '\n' ||
          P.L.src[checkI + delimLen] === '\r')
      ) {
        hd.bodyEnd = lineStartB
        // Advance past tabs
        while (P.L.i < checkI) advance(P.L)
        hd.endStart = P.L.b
        // Advance past delimiter
        for (let k = 0; k < delimLen; k++) advance(P.L)
        hd.endEnd = P.L.b
        // Skip trailing newline
        if (P.L.i < P.L.len && P.L.src[P.L.i] === '\n') advance(P.L)
        return
      }
      // Consume line
      while (P.L.i < P.L.len && P.L.src[P.L.i] !== '\n') advance(P.L)
      if (P.L.i < P.L.len) advance(P.L)
    }
    // Unterminated
    hd.bodyEnd = P.L.b
    hd.endStart = P.L.b
    hd.endEnd = P.L.b
  }
}

function parseHeredocBodyContent(
  P: ParseState,
  start: number,
  end: number,
): TsNode[] {
  // Parse expansions inside an unquoted heredoc body.
  const saved = saveLex(P.L)
  // Position lexer at body start
  restoreLexToByte(P, start)
  const out: TsNode[] = []
  let contentStart = P.L.b
  // tree-sitter-bash's heredoc_body rule hides the initial text segment
  // (_heredoc_body_beginning) — only content AFTER the first expansion is
  // emitted as heredoc_content. Track whether we've seen an expansion yet.
  let sawExpansion = false
  while (P.L.b < end) {
    const c = peek(P.L)
    // Backslash escapes suppress expansion: \$ \` stay literal in heredoc.
    if (c === '\\') {
      const nxt = peek(P.L, 1)
      if (nxt === '$' || nxt === '`' || nxt === '\\') {
        advance(P.L)
        advance(P.L)
        continue
      }
      advance(P.L)
      continue
    }
    if (c === '$' || c === '`') {
      const preB = P.L.b
      const exp = parseDollarLike(P)
      // Bare `$` followed by non-name (e.g. `$'` in a regex) returns a lone
      // '$' leaf, not an expansion — treat as literal content, don't split.
      if (
        exp &&
        (exp.type === 'simple_expansion' ||
          exp.type === 'expansion' ||
          exp.type === 'command_substitution' ||
          exp.type === 'arithmetic_expansion')
      ) {
        if (sawExpansion && preB > contentStart) {
          out.push(mk(P, 'heredoc_content', contentStart, preB, []))
        }
        out.push(exp)
        contentStart = P.L.b
        sawExpansion = true
      }
      continue
    }
    advance(P.L)
  }
  // Only emit heredoc_content children if there were expansions — otherwise
  // the heredoc_body is a leaf node (tree-sitter convention).
  if (sawExpansion) {
    out.push(mk(P, 'heredoc_content', contentStart, end, []))
  }
  restoreLex(P.L, saved)
  return out
}

function restoreLexToByte(P: ParseState, targetByte: number): void {
  if (!P.L.byteTable) byteAt(P.L, 0)
  const t = P.L.byteTable!
  let lo = 0
  let hi = P.src.length
  while (lo < hi) {
    const m = (lo + hi) >>> 1
    if (t[m]! < targetByte) lo = m + 1
    else hi = m
  }
  P.L.i = lo
  P.L.b = targetByte
}

/**
 * Parse a word-position element: bare word, string, expansion, or concatenation
 * thereof. Returns a single node; if multiple adjacent fragments, wraps in
 * concatenation.
 */
function parseWord(P: ParseState, _ctx: 'cmd' | 'arg'): TsNode | null {
  skipBlanks(P.L)
  const parts: TsNode[] = []
  while (P.L.i < P.L.len) {
    const c = peek(P.L)
    if (
      c === ' ' ||
      c === '\t' ||
      c === '\n' ||
      c === '\r' ||
      c === '' ||
      c === '|' ||
      c === '&' ||
      c === ';' ||
      c === '(' ||
      c === ')'
    ) {
      break
    }
    // < > are redirect operators unless <( >( (process substitution)
    if (c === '<' || c === '>') {
      if (peek(P.L, 1) === '(') {
        const ps = parseProcessSub(P)
        if (ps) parts.push(ps)
        continue
      }
      break
    }
    if (c === '"') {
      parts.push(parseDoubleQuoted(P))
      continue
    }
    if (c === "'") {
      const tok = nextToken(P.L, 'arg')
      parts.push(leaf(P, 'raw_string', tok))
      continue
    }
    if (c === '$') {
      const c1 = peek(P.L, 1)
      if (c1 === "'") {
        const tok = nextToken(P.L, 'arg')
        parts.push(leaf(P, 'ansi_c_string', tok))
        continue
      }
      if (c1 === '"') {
        // Translated string: emit $ leaf + string node
        const dTok: Token = {
          type: 'DOLLAR',
          value: '$',
          start: P.L.b,
          end: P.L.b + 1,
        }
        advance(P.L)
        parts.push(leaf(P, '$', dTok))
        parts.push(parseDoubleQuoted(P))
        continue
      }
      if (c1 === '`') {
        // `$` followed by backtick — tree-sitter elides the $ entirely
        // and emits just (command_substitution). Consume $ and let next
        // iteration handle the backtick.
        advance(P.L)
        continue
      }
      const exp = parseDollarLike(P)
      if (exp) parts.push(exp)
      continue
    }
    if (c === '`') {
      if (P.inBacktick > 0) break
      const bt = parseBacktick(P)
      if (bt) parts.push(bt)
      continue
    }
    // Brace expression {1..5} or {a,b,c} — only if looks like one
    if (c === '{') {
      const be = tryParseBraceExpr(P)
      if (be) {
        parts.push(be)
        continue
      }
      // SECURITY: if `{` is immediately followed by a command terminator
      // (; | & newline or EOF), it's a standalone word — don't slurp the
      // rest of the line via tryParseBraceLikeCat. `echo {;touch /tmp/evil`
      // must split on `;` so the security walker sees `touch`.
      const nc = peek(P.L, 1)
      if (
        nc === ';' ||
        nc === '|' ||
        nc === '&' ||
        nc === '\n' ||
        nc === '' ||
        nc === ')' ||
        nc === ' ' ||
        nc === '\t'
      ) {
        const bStart = P.L.b
        advance(P.L)
        parts.push(mk(P, 'word', bStart, P.L.b, []))
        continue
      }
      // Otherwise treat { and } as word fragments
      const cat = tryParseBraceLikeCat(P)
      if (cat) {
        for (const p of cat) parts.push(p)
        continue
      }
    }
    // Standalone `}` in arg position is a word (e.g., `echo }foo`).
    // parseBareWord breaks on `}` so handle it here.
    if (c === '}') {
      const bStart = P.L.b
      advance(P.L)
      parts.push(mk(P, 'word', bStart, P.L.b, []))
      continue
    }
    // `[` and `]` are single-char word fragments (tree-sitter splits at
    // brackets: `[:lower:]` → `[` `:lower:` `]`, `{o[k]}` → 6 words).
    if (c === '[' || c === ']') {
      const bStart = P.L.b
      advance(P.L)
      parts.push(mk(P, 'word', bStart, P.L.b, []))
      continue
    }
    // Bare word fragment
    const frag = parseBareWord(P)
    if (!frag) break
    // `NN#${...}` or `NN#$(...)` → (number (expansion|command_substitution)).
    // Grammar: number can be seq(/-?(0x)?[0-9]+#/, choice(expansion, cmd_sub)).
    // `10#${cmd}` must NOT be concatenation — it's a single number node with
    // the expansion as child. Detect here: frag ends with `#`, next is $ {/(.
    if (
      frag.type === 'word' &&
      /^-?(0x)?[0-9]+#$/.test(frag.text) &&
      peek(P.L) === '$' &&
      (peek(P.L, 1) === '{' || peek(P.L, 1) === '(')
    ) {
      const exp = parseDollarLike(P)
      if (exp) {
        // Prefix `NN#` is an anonymous pattern in grammar — only the
        // expansion/cmd_sub is a named child.
        parts.push(mk(P, 'number', frag.startIndex, exp.endIndex, [exp]))
        continue
      }
    }
    parts.push(frag)
  }
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]!
  // Concatenation
  const first = parts[0]!
  const last = parts[parts.length - 1]!
  return mk(P, 'concatenation', first.startIndex, last.endIndex, parts)
}

function parseBareWord(P: ParseState): TsNode | null {
  const start = P.L.b
  const startI = P.L.i
  while (P.L.i < P.L.len) {
    const c = peek(P.L)
    if (c === '\\') {
      if (P.L.i + 1 >= P.L.len) {
        // Trailing unpaired `\` at true EOF — tree-sitter emits word WITHOUT
        // the `\` plus a sibling ERROR node. Stop here; caller emits ERROR.
        break
      }
      const nx = P.L.src[P.L.i + 1]
      if (nx === '\n' || (nx === '\r' && P.L.src[P.L.i + 2] === '\n')) {
        // Line continuation BREAKS the word (tree-sitter quirk) — handles \r?\n
        break
      }
      advance(P.L)
      advance(P.L)
      continue
    }
    if (
      c === ' ' ||
      c === '\t' ||
      c === '\n' ||
      c === '\r' ||
      c === '' ||
      c === '|' ||
      c === '&' ||
      c === ';' ||
      c === '(' ||
      c === ')' ||
      c === '<' ||
      c === '>' ||
      c === '"' ||
      c === "'" ||
      c === '$' ||
      c === '`' ||
      c === '{' ||
      c === '}' ||
      c === '[' ||
      c === ']'
    ) {
      break
    }
    advance(P.L)
  }
  if (P.L.b === start) return null
  const text = P.src.slice(startI, P.L.i)
  const type = /^-?\d+$/.test(text) ? 'number' : 'word'
  return mk(P, type, start, P.L.b, [])
}

function tryParseBraceExpr(P: ParseState): TsNode | null {
  // {N..M} where N, M are numbers or single chars
  const save = saveLex(P.L)
  if (peek(P.L) !== '{') return null
  const oStart = P.L.b
  advance(P.L)
  const oEnd = P.L.b
  // First part
  const p1Start = P.L.b
  while (isDigit(peek(P.L)) || isIdentStart(peek(P.L))) advance(P.L)
  const p1End = P.L.b
  if (p1End === p1Start || peek(P.L) !== '.' || peek(P.L, 1) !== '.') {
    restoreLex(P.L, save)
    return null
  }
  const dotStart = P.L.b
  advance(P.L)
  advance(P.L)
  const dotEnd = P.L.b
  const p2Start = P.L.b
  while (isDigit(peek(P.L)) || isIdentStart(peek(P.L))) advance(P.L)
  const p2End = P.L.b
  if (p2End === p2Start || peek(P.L) !== '}') {
    restoreLex(P.L, save)
    return null
  }
  const cStart = P.L.b
  advance(P.L)
  const cEnd = P.L.b
  const p1Text = sliceBytes(P, p1Start, p1End)
  const p2Text = sliceBytes(P, p2Start, p2End)
  const p1IsNum = /^\d+$/.test(p1Text)
  const p2IsNum = /^\d+$/.test(p2Text)
  // Valid brace expression: both numbers OR both single chars. Mixed = reject.
  if (p1IsNum !== p2IsNum) {
    restoreLex(P.L, save)
    return null
  }
  if (!p1IsNum && (p1Text.length !== 1 || p2Text.length !== 1)) {
    restoreLex(P.L, save)
    return null
  }
  const p1Type = p1IsNum ? 'number' : 'word'
  const p2Type = p2IsNum ? 'number' : 'word'
  return mk(P, 'brace_expression', oStart, cEnd, [
    mk(P, '{', oStart, oEnd, []),
    mk(P, p1Type, p1Start, p1End, []),
    mk(P, '..', dotStart, dotEnd, []),
    mk(P, p2Type, p2Start, p2End, []),
    mk(P, '}', cStart, cEnd, []),
  ])
}

function tryParseBraceLikeCat(P: ParseState): TsNode[] | null {
  // {a,b,c} or {} → split into word fragments like tree-sitter does
  if (peek(P.L) !== '{') return null
  const oStart = P.L.b
  advance(P.L)
  const oEnd = P.L.b
  const inner: TsNode[] = [mk(P, 'word', oStart, oEnd, [])]
  while (P.L.i < P.L.len) {
    const bc = peek(P.L)
    // SECURITY: stop at command terminators so `{foo;rm x` splits correctly.
    if (
      bc === '}' ||
      bc === '\n' ||
      bc === ';' ||
      bc === '|' ||
      bc === '&' ||
      bc === ' ' ||
      bc === '\t' ||
      bc === '<' ||
      bc === '>' ||
      bc === '(' ||
      bc === ')'
    ) {
      break
    }
    // `[` and `]` are single-char words: {o[k]} → { o [ k ] }
    if (bc === '[' || bc === ']') {
      const bStart = P.L.b
      advance(P.L)
      inner.push(mk(P, 'word', bStart, P.L.b, []))
      continue
    }
    const midStart = P.L.b
    while (P.L.i < P.L.len) {
      const mc = peek(P.L)
      if (
        mc === '}' ||
        mc === '\n' ||
        mc === ';' ||
        mc === '|' ||
        mc === '&' ||
        mc === ' ' ||
        mc === '\t' ||
        mc === '<' ||
        mc === '>' ||
        mc === '(' ||
        mc === ')' ||
        mc === '[' ||
        mc === ']'
      ) {
        break
      }
      advance(P.L)
    }
    const midEnd = P.L.b
    if (midEnd > midStart) {
      const midText = sliceBytes(P, midStart, midEnd)
      const midType = /^-?\d+$/.test(midText) ? 'number' : 'word'
      inner.push(mk(P, midType, midStart, midEnd, []))
    } else {
      break
    }
  }
  if (peek(P.L) === '}') {
    const cStart = P.L.b
    advance(P.L)
    inner.push(mk(P, 'word', cStart, P.L.b, []))
  }
  return inner
}

function parseDoubleQuoted(P: ParseState): TsNode {
  const qStart = P.L.b
  advance(P.L)
  const qEnd = P.L.b
  const openQ = mk(P, '"', qStart, qEnd, [])
  const parts: TsNode[] = [openQ]
  let contentStart = P.L.b
  let contentStartI = P.L.i
  const flushContent = (): void => {
    if (P.L.b > contentStart) {
      // Tree-sitter's extras rule /\s/ has higher precedence than
      // string_content (prec -1), so whitespace-only segments are elided.
      // `" ${x} "` → (string (expansion)) not (string (string_content)(expansion)(string_content)).
      // Note: this intentionally diverges from preserving all content — cc
      // tests relying on whitespace-only string_content need updating
      // (CCReconcile).
      const txt = P.src.slice(contentStartI, P.L.i)
      if (!/^[ \t]+$/.test(txt)) {
        parts.push(mk(P, 'string_content', contentStart, P.L.b, []))
      }
    }
  }
  while (P.L.i < P.L.len) {
    const c = peek(P.L)
    if (c === '"') break
    if (c === '\\' && P.L.i + 1 < P.L.len) {
      advance(P.L)
      advance(P.L)
      continue
    }
    if (c === '\n') {
      // Split string_content at newline
      flushContent()
      advance(P.L)
      contentStart = P.L.b
      contentStartI = P.L.i
      continue
    }
    if (c === '$') {
      const c1 = peek(P.L, 1)
      if (
        c1 === '(' ||
        c1 === '{' ||
        isIdentStart(c1) ||
        SPECIAL_VARS.has(c1) ||
        isDigit(c1)
      ) {
        flushContent()
        const exp = parseDollarLike(P)
        if (exp) parts.push(exp)
        contentStart = P.L.b
        contentStartI = P.L.i
        continue
      }
      // Bare $ not at end-of-string: tree-sitter emits it as an anonymous
      // '$' token, which splits string_content. $ immediately before the
      // closing " is absorbed into the preceding string_content.
      if (c1 !== '"' && c1 !== '') {
        flushContent()
        const dS = P.L.b
        advance(P.L)
        parts.push(mk(P, '$', dS, P.L.b, []))
        contentStart = P.L.b
        contentStartI = P.L.i
        continue
      }
    }
    if (c === '`') {
      flushContent()
      const bt = parseBacktick(P)
      if (bt) parts.push(bt)
      contentStart = P.L.b
      contentStartI = P.L.i
      continue
    }
    advance(P.L)
  }
  flushContent()
  let close: TsNode
  if (peek(P.L) === '"') {
    const cStart = P.L.b
    advance(P.L)
    close = mk(P, '"', cStart, P.L.b, [])
  } else {
    close = mk(P, '"', P.L.b, P.L.b, [])
  }
  parts.push(close)
  return mk(P, 'string', qStart, close.endIndex, parts)
}

function parseDollarLike(P: ParseState): TsNode | null {
  const c1 = peek(P.L, 1)
  const dStart = P.L.b
  if (c1 === '(' && peek(P.L, 2) === '(') {
    // $(( arithmetic ))
    advance(P.L)
    advance(P.L)
    advance(P.L)
    const open = mk(P, '$((', dStart, P.L.b, [])
    const exprs = parseArithCommaList(P, '))', 'var')
    skipBlanks(P.L)
    let close: TsNode
    if (peek(P.L) === ')' && peek(P.L, 1) === ')') {
      const cStart = P.L.b
      advance(P.L)
      advance(P.L)
      close = mk(P, '))', cStart, P.L.b, [])
    } else {
      close = mk(P, '))', P.L.b, P.L.b, [])
    }
    return mk(P, 'arithmetic_expansion', dStart, close.endIndex, [
      open,
      ...exprs,
      close,
    ])
  }
  if (c1 === '[') {
    // $[ arithmetic ] — legacy bash syntax, same as $((...))
    advance(P.L)
    advance(P.L)
    const open = mk(P, '$[', dStart, P.L.b, [])
    const exprs = parseArithCommaList(P, ']', 'var')
    skipBlanks(P.L)
    let close: TsNode
    if (peek(P.L) === ']') {
      const cStart = P.L.b
      advance(P.L)
      close = mk(P, ']', cStart, P.L.b, [])
    } else {
      close = mk(P, ']', P.L.b, P.L.b, [])
    }
    return mk(P, 'arithmetic_expansion', dStart, close.endIndex, [
      open,
      ...exprs,
      close,
    ])
  }
  if (c1 === '(') {
    advance(P.L)
    advance(P.L)
    const open = mk(P, '$(', dStart, P.L.b, [])
    let body = parseStatements(P, ')')
    skipBlanks(P.L)
    let close: TsNode
    if (peek(P.L) === ')') {
      const cStart = P.L.b
      advance(P.L)
      close = mk(P, ')', cStart, P.L.b, [])
    } else {
      close = mk(P, ')', P.L.b, P.L.b, [])
    }
    // $(< file) shorthand: unwrap redirected_statement → bare file_redirect
    // tree-sitter emits (command_substitution (file_redirect (word))) directly
    if (
      body.length === 1 &&
      body[0]!.type === 'redirected_statement' &&
      body[0]!.children.length === 1 &&
      body[0]!.children[0]!.type === 'file_redirect'
    ) {
      body = body[0]!.children
    }
    return mk(P, 'command_substitution', dStart, close.endIndex, [
      open,
      ...body,
      close,
    ])
  }
  if (c1 === '{') {
    advance(P.L)
    advance(P.L)
    const open = mk(P, '${', dStart, P.L.b, [])
    const inner = parseExpansionBody(P)
    let close: TsNode
    if (peek(P.L) === '}') {
      const cStart = P.L.b
      advance(P.L)
      close = mk(P, '}', cStart, P.L.b, [])
    } else {
      close = mk(P, '}', P.L.b, P.L.b, [])
    }
    return mk(P, 'expansion', dStart, close.endIndex, [open, ...inner, close])
  }
  // Simple expansion $VAR or $? $$ $@ etc
  advance(P.L)
  const dEnd = P.L.b
  const dollar = mk(P, '$', dStart, dEnd, [])
  const nc = peek(P.L)
  // $_ is special_variable_name only when not followed by more ident chars
  if (nc === '_' && !isIdentChar(peek(P.L, 1))) {
    const vStart = P.L.b
    advance(P.L)
    const vn = mk(P, 'special_variable_name', vStart, P.L.b, [])
    return mk(P, 'simple_expansion', dStart, P.L.b, [dollar, vn])
  }
  if (isIdentStart(nc)) {
    const vStart = P.L.b
    while (isIdentChar(peek(P.L))) advance(P.L)
    const vn = mk(P, 'variable_name', vStart, P.L.b, [])
    return mk(P, 'simple_expansion', dStart, P.L.b, [dollar, vn])
  }
  if (isDigit(nc)) {
    const vStart = P.L.b
    advance(P.L)
    const vn = mk(P, 'variable_name', vStart, P.L.b, [])
    return mk(P, 'simple_expansion', dStart, P.L.b, [dollar, vn])
  }
  if (SPECIAL_VARS.has(nc)) {
    const vStart = P.L.b
    advance(P.L)
    const vn = mk(P, 'special_variable_name', vStart, P.L.b, [])
    return mk(P, 'simple_expansion', dStart, P.L.b, [dollar, vn])
  }
  // Bare $ — just a $ leaf (tree-sitter treats trailing $ as literal)
  return dollar
}

function parseExpansionBody(P: ParseState): TsNode[] {
  const out: TsNode[] = []
  skipBlanks(P.L)
  // Bizarre cases: ${#!} ${!#} ${!##} ${!# } ${!## } all emit empty (expansion)
  // — both # and ! become anonymous nodes when only combined with each other
  // and optional trailing space before }. Note ${!##/} does NOT match (has
  // content after), so it parses normally as (special_variable_name)(regex).
  {
    const c0 = peek(P.L)
    const c1 = peek(P.L, 1)
    if (c0 === '#' && c1 === '!' && peek(P.L, 2) === '}') {
      advance(P.L)
      advance(P.L)
      return out
    }
    if (c0 === '!' && c1 === '#') {
      // ${!#} ${!##} with optional trailing space then }
      let j = 2
      if (peek(P.L, j) === '#') j++
      if (peek(P.L, j) === ' ') j++
      if (peek(P.L, j) === '}') {
        while (j-- > 0) advance(P.L)
        return out
      }
    }
  }
  // Optional # prefix for length
  if (peek(P.L) === '#') {
    const s = P.L.b
    advance(P.L)
    out.push(mk(P, '#', s, P.L.b, []))
  }
  // Optional ! prefix for indirect expansion: ${!varname} ${!prefix*} ${!prefix@}
  // Only when followed by an identifier — ${!} alone is special var $!
  // Also = ~ prefixes (zsh-style ${=var} ${~var})
  const pc = peek(P.L)
  if (
    (pc === '!' || pc === '=' || pc === '~') &&
    (isIdentStart(peek(P.L, 1)) || isDigit(peek(P.L, 1)))
  ) {
    const s = P.L.b
    advance(P.L)
    out.push(mk(P, pc, s, P.L.b, []))
  }
  skipBlanks(P.L)
  // Variable name
  if (isIdentStart(peek(P.L))) {
    const s = P.L.b
    while (isIdentChar(peek(P.L))) advance(P.L)
    out.push(mk(P, 'variable_name', s, P.L.b, []))
  } else if (isDigit(peek(P.L))) {
    const s = P.L.b
    while (isDigit(peek(P.L))) advance(P.L)
    out.push(mk(P, 'variable_name', s, P.L.b, []))
  } else if (SPECIAL_VARS.has(peek(P.L))) {
    const s = P.L.b
    advance(P.L)
    out.push(mk(P, 'special_variable_name', s, P.L.b, []))
  }
  // Optional subscript [idx] — parsed arithmetically
  if (peek(P.L) === '[') {
    const varNode = out[out.length - 1]
    const brOpen = P.L.b
    advance(P.L)
    const brOpenNode = mk(P, '[', brOpen, P.L.b, [])
    const idx = parseSubscriptIndexInline(P)
    skipBlanks(P.L)
    const brClose = P.L.b
    if (peek(P.L) === ']') advance(P.L)
    const brCloseNode = mk(P, ']', brClose, P.L.b, [])
    if (varNode) {
      const kids = idx
        ? [varNode, brOpenNode, idx, brCloseNode]
        : [varNode, brOpenNode, brCloseNode]
      out[out.length - 1] = mk(P, 'subscript', varNode.startIndex, P.L.b, kids)
    }
  }
  skipBlanks(P.L)
  // Trailing * or @ for indirect expansion (${!prefix*} ${!prefix@}) or
  // @operator for parameter transformation (${var@U} ${var@Q}) — anonymous
  const tc = peek(P.L)
  if ((tc === '*' || tc === '@') && peek(P.L, 1) === '}') {
    const s = P.L.b
    advance(P.L)
    out.push(mk(P, tc, s, P.L.b, []))
    return out
  }
  if (tc === '@' && isIdentStart(peek(P.L, 1))) {
    // ${var@U} transformation — @ is anonymous, consume op char(s)
    const s = P.L.b
    advance(P.L)
    out.push(mk(P, '@', s, P.L.b, []))
    while (isIdentChar(peek(P.L))) advance(P.L)
    return out
  }
  // Operator :- := :? :+ - = ? + # ## % %% / // ^ ^^ , ,, etc.
  const c = peek(P.L)
  // Bare `:` substring operator ${var:off:len} — offset and length parsed
  // arithmetically. Must come BEFORE the generic operator handling so `(` after
  // `:` goes to parenthesized_expression not the array path. `:-` `:=` `:?`
  // `:+` (no space) remain default-value operators; `: -1` (with space before
  // -1) is substring with negative offset.
  if (c === ':') {
    const c1 = peek(P.L, 1)
    // `:\n` or `:}` — empty substring expansion, emits nothing (variable_name only)
    if (c1 === '\n' || c1 === '}') {
      advance(P.L)
      while (peek(P.L) === '\n') advance(P.L)
      return out
    }
    if (c1 !== '-' && c1 !== '=' && c1 !== '?' && c1 !== '+') {
      advance(P.L)
      skipBlanks(P.L)
      // Offset — arithmetic. `-N` at top level is a single number node per
      // tree-sitter; inside parens it's unary_expression(number).
      const offC = peek(P.L)
      let off: TsNode | null
      if (offC === '-' && isDigit(peek(P.L, 1))) {
        const ns = P.L.b
        advance(P.L)
        while (isDigit(peek(P.L))) advance(P.L)
        off = mk(P, 'number', ns, P.L.b, [])
      } else {
        off = parseArithExpr(P, ':}', 'var')
      }
      if (off) out.push(off)
      skipBlanks(P.L)
      if (peek(P.L) === ':') {
        advance(P.L)
        skipBlanks(P.L)
        const lenC = peek(P.L)
        let len: TsNode | null
        if (lenC === '-' && isDigit(peek(P.L, 1))) {
          const ns = P.L.b
          advance(P.L)
          while (isDigit(peek(P.L))) advance(P.L)
          len = mk(P, 'number', ns, P.L.b, [])
        } else {
          len = parseArithExpr(P, '}', 'var')
        }
        if (len) out.push(len)
      }
      return out
    }
  }
  if (
    c === ':' ||
    c === '#' ||
    c === '%' ||
    c === '/' ||
    c === '^' ||
    c === ',' ||
    c === '-' ||
    c === '=' ||
    c === '?' ||
    c === '+'
  ) {
    const s = P.L.b
    const c1 = peek(P.L, 1)
    let op = c
    if (c === ':' && (c1 === '-' || c1 === '=' || c1 === '?' || c1 === '+')) {
      advance(P.L)
      advance(P.L)
      op = c + c1
    } else if (
      (c === '#' || c === '%' || c === '/' || c === '^' || c === ',') &&
      c1 === c
    ) {
      // Doubled operators: ## %% // ^^ ,,
      advance(P.L)
      advance(P.L)
      op = c + c
    } else {
      advance(P.L)
    }
    out.push(mk(P, op, s, P.L.b, []))
    // Rest is the default/replacement — parse as word or regex until }
    // Pattern-matching operators (# ## % %% / // ^ ^^ , ,,) emit regex;
    // value-substitution operators (:- := :? :+ - = ? + :) emit word.
    // `/` and `//` split at next `/` into (regex)+(word) for pat/repl.
    const isPattern =
      op === '#' ||
      op === '##' ||
      op === '%' ||
      op === '%%' ||
      op === '/' ||
      op === '//' ||
      op === '^' ||
      op === '^^' ||
      op === ',' ||
      op === ',,'
    if (op === '/' || op === '//') {
      // Optional /# or /% anchor prefix — anonymous node
      const ac = peek(P.L)
      if (ac === '#' || ac === '%') {
        const aStart = P.L.b
        advance(P.L)
        out.push(mk(P, ac, aStart, P.L.b, []))
      }
      // Pattern: per grammar _expansion_regex_replacement, pattern is
      // choice(regex, string, cmd_sub, seq(string, regex)). If it STARTS
      // with ", emit (string) and any trailing chars become (regex).
      // `${v//"${old}"/}` → (string(expansion)); `${v//"${c}"\//}` →
      // (string)(regex).
      if (peek(P.L) === '"') {
        out.push(parseDoubleQuoted(P))
        const tail = parseExpansionRest(P, 'regex', true)
        if (tail) out.push(tail)
      } else {
        const regex = parseExpansionRest(P, 'regex', true)
        if (regex) out.push(regex)
      }
      if (peek(P.L) === '/') {
        const sepStart = P.L.b
        advance(P.L)
        out.push(mk(P, '/', sepStart, P.L.b, []))
        // Replacement: per grammar, choice includes `seq(cmd_sub, word)`
        // which emits TWO siblings (not concatenation). Also `(` at start
        // of replacement is a regular word char, NOT array — unlike `:-`
        // default-value context. `${v/(/(Gentoo ${x}, }` replacement
        // `(Gentoo ${x}, ` is (concatenation (word)(expansion)(word)).
        const repl = parseExpansionRest(P, 'replword', false)
        if (repl) {
          // seq(cmd_sub, word) special case → siblings. Detected when
          // replacement is a concatenation of exactly 2 parts with first
          // being command_substitution.
          if (
            repl.type === 'concatenation' &&
            repl.children.length === 2 &&
            repl.children[0]!.type === 'command_substitution'
          ) {
            out.push(repl.children[0]!)
            out.push(repl.children[1]!)
          } else {
            out.push(repl)
          }
        }
      }
    } else if (op === '#' || op === '##' || op === '%' || op === '%%') {
      // Pattern-removal: per grammar _expansion_regex, pattern is
      // repeat(choice(regex, string, raw_string, ')')). Each quote/string
      // is a SIBLING, not absorbed into one regex. `${f%'str'*}` →
      // (raw_string)(regex); `${f/'str'*}` (slash) stays single regex.
      for (const p of parseExpansionRegexSegmented(P)) out.push(p)
    } else {
      const rest = parseExpansionRest(P, isPattern ? 'regex' : 'word', false)
      if (rest) out.push(rest)
    }
  }
  return out
}

function parseExpansionRest(
  P: ParseState,
  nodeType: string,
  stopAtSlash: boolean,
): TsNode | null {
  // Don't skipBlanks — `${var:- }` space IS the word. Stop at } or newline
  // (`${var:\n}` emits no word). stopAtSlash=true stops at `/` for pat/repl
  // split in ${var/pat/repl}. nodeType 'replword' is word-mode for the
  // replacement in `/` `//` — same as 'word' but `(` is NOT array.
  const start = P.L.b
  // Value-substitution RHS starting with `(` parses as array: ${var:-(x)} →
  // (expansion (variable_name) (array (word))). Only for 'word' context (not
  // pattern-matching operators which emit regex, and not 'replword' where `(`
  // is a regular char per grammar `_expansion_regex_replacement`).
  if (nodeType === 'word' && peek(P.L) === '(') {
    advance(P.L)
    const open = mk(P, '(', start, P.L.b, [])
    const elems: TsNode[] = [open]
    while (P.L.i < P.L.len) {
      skipBlanks(P.L)
      const c = peek(P.L)
      if (c === ')' || c === '}' || c === '\n' || c === '') break
      const wStart = P.L.b
      while (P.L.i < P.L.len) {
        const wc = peek(P.L)
        if (
          wc === ')' ||
          wc === '}' ||
          wc === ' ' ||
          wc === '\t' ||
          wc === '\n' ||
          wc === ''
        ) {
          break
        }
        advance(P.L)
      }
      if (P.L.b > wStart) elems.push(mk(P, 'word', wStart, P.L.b, []))
      else break
    }
    if (peek(P.L) === ')') {
      const cStart = P.L.b
      advance(P.L)
      elems.push(mk(P, ')', cStart, P.L.b, []))
    }
    while (peek(P.L) === '\n') advance(P.L)
    return mk(P, 'array', start, P.L.b, elems)
  }
  // REGEX mode: flat single-span scan. Quotes are opaque (skipped past so
  // `/` inside them doesn't break stopAtSlash), but NOT emitted as separate
  // nodes — the entire range becomes one regex node.
  if (nodeType === 'regex') {
    let braceDepth = 0
    while (P.L.i < P.L.len) {
      const c = peek(P.L)
      if (c === '\n') break
      if (braceDepth === 0) {
        if (c === '}') break
        if (stopAtSlash && c === '/') break
      }
      if (c === '\\' && P.L.i + 1 < P.L.len) {
        advance(P.L)
        advance(P.L)
        continue
      }
      if (c === '"' || c === "'") {
        advance(P.L)
        while (P.L.i < P.L.len && peek(P.L) !== c) {
          if (peek(P.L) === '\\' && P.L.i + 1 < P.L.len) advance(P.L)
          advance(P.L)
        }
        if (peek(P.L) === c) advance(P.L)
        continue
      }
      // Skip past nested ${...} $(...) $[...] so their } / don't terminate us
      if (c === '$') {
        const c1 = peek(P.L, 1)
        if (c1 === '{') {
          let d = 0
          advance(P.L)
          advance(P.L)
          d++
          while (P.L.i < P.L.len && d > 0) {
            const nc = peek(P.L)
            if (nc === '{') d++
            else if (nc === '}') d--
            advance(P.L)
          }
          continue
        }
        if (c1 === '(') {
          let d = 0
          advance(P.L)
          advance(P.L)
          d++
          while (P.L.i < P.L.len && d > 0) {
            const nc = peek(P.L)
            if (nc === '(') d++
            else if (nc === ')') d--
            advance(P.L)
          }
          continue
        }
      }
      if (c === '{') braceDepth++
      else if (c === '}' && braceDepth > 0) braceDepth--
      advance(P.L)
    }
    const end = P.L.b
    while (peek(P.L) === '\n') advance(P.L)
    if (end === start) return null
    return mk(P, 'regex', start, end, [])
  }
  // WORD mode: segmenting parser — recognize nested ${...}, $(...), $'...',
  // "...", '...', $ident, <(...)/>(...); bare chars accumulate into word
  // segments. Multiple parts → wrapped in concatenation.
  const parts: TsNode[] = []
  let segStart = P.L.b
  let braceDepth = 0
  const flushSeg = (): void => {
    if (P.L.b > segStart) {
      parts.push(mk(P, 'word', segStart, P.L.b, []))
    }
  }
  while (P.L.i < P.L.len) {
    const c = peek(P.L)
    if (c === '\n') break
    if (braceDepth === 0) {
      if (c === '}') break
      if (stopAtSlash && c === '/') break
    }
    if (c === '\\' && P.L.i + 1 < P.L.len) {
      advance(P.L)
      advance(P.L)
      continue
    }
    const c1 = peek(P.L, 1)
    if (c === '$') {
      if (c1 === '{' || c1 === '(' || c1 === '[') {
        flushSeg()
        const exp = parseDollarLike(P)
        if (exp) parts.push(exp)
        segStart = P.L.b
        continue
      }
      if (c1 === "'") {
        // $'...' ANSI-C string
        flushSeg()
        const aStart = P.L.b
        advance(P.L)
        advance(P.L)
        while (P.L.i < P.L.len && peek(P.L) !== "'") {
          if (peek(P.L) === '\\' && P.L.i + 1 < P.L.len) advance(P.L)
          advance(P.L)
        }
        if (peek(P.L) === "'") advance(P.L)
        parts.push(mk(P, 'ansi_c_string', aStart, P.L.b, []))
        segStart = P.L.b
        continue
      }
      if (isIdentStart(c1) || isDigit(c1) || SPECIAL_VARS.has(c1)) {
        flushSeg()
        const exp = parseDollarLike(P)
        if (exp) parts.push(exp)
        segStart = P.L.b
        continue
      }
    }
    if (c === '"') {
      flushSeg()
      parts.push(parseDoubleQuoted(P))
      segStart = P.L.b
      continue
    }
    if (c === "'") {
      flushSeg()
      const rStart = P.L.b
      advance(P.L)
      while (P.L.i < P.L.len && peek(P.L) !== "'") advance(P.L)
      if (peek(P.L) === "'") advance(P.L)
      parts.push(mk(P, 'raw_string', rStart, P.L.b, []))
      segStart = P.L.b
      continue
    }
    if ((c === '<' || c === '>') && c1 === '(') {
      flushSeg()
      const ps = parseProcessSub(P)
      if (ps) parts.push(ps)
      segStart = P.L.b
      continue
    }
    if (c === '`') {
      flushSeg()
      const bt = parseBacktick(P)
      if (bt) parts.push(bt)
      segStart = P.L.b
      continue
    }
    // Brace tracking so nested {a,b} brace-expansion chars don't prematurely
    // terminate (rare, but the `?` in `${cond}? (` should be treated as word).
    if (c === '{') braceDepth++
    else if (c === '}' && braceDepth > 0) braceDepth--
    advance(P.L)
  }
  flushSeg()
  // Consume trailing newlines before } so caller sees }
  while (peek(P.L) === '\n') advance(P.L)
  // Tree-sitter skips leading whitespace (extras) in expansion RHS when
  // there's content after: `${2+ ${2}}` → just (expansion). But `${v:- }`
  // (space-only RHS) keeps the space as (word). So drop leading whitespace-
  // only word segment if it's NOT the only part.
  if (
    parts.length > 1 &&
    parts[0]!.type === 'word' &&
    /^[ \t]+$/.test(parts[0]!.text)
  ) {
    parts.shift()
  }
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]!
  // Multiple parts: wrap in concatenation (word mode keeps concat wrapping;
  // regex mode also concats per tree-sitter for mixed quote+glob patterns).
  const last = parts[parts.length - 1]!
  return mk(P, 'concatenation', parts[0]!.startIndex, last.endIndex, parts)
}

// Pattern for # ## % %% operators — per grammar _expansion_regex:
// repeat(choice(regex, string, raw_string, ')', /\s+/→regex)). Each quote
// becomes a SIBLING node, not absorbed. `${f%'str'*}` → (raw_string)(regex).
function parseExpansionRegexSegmented(P: ParseState): TsNode[] {
  const out: TsNode[] = []
  let segStart = P.L.b
  const flushRegex = (): void => {
    if (P.L.b > segStart) out.push(mk(P, 'regex', segStart, P.L.b, []))
  }
  while (P.L.i < P.L.len) {
    const c = peek(P.L)
    if (c === '}' || c === '\n') break
    if (c === '\\' && P.L.i + 1 < P.L.len) {
      advance(P.L)
      advance(P.L)
      continue
    }
    if (c === '"') {
      flushRegex()
      out.push(parseDoubleQuoted(P))
      segStart = P.L.b
      continue
    }
    if (c === "'") {
      flushRegex()
      const rStart = P.L.b
      advance(P.L)
      while (P.L.i < P.L.len && peek(P.L) !== "'") advance(P.L)
      if (peek(P.L) === "'") advance(P.L)
      out.push(mk(P, 'raw_string', rStart, P.L.b, []))
      segStart = P.L.b
      continue
    }
    // Nested ${...} $(...) — opaque scan so their } doesn't terminate us
    if (c === '$') {
      const c1 = peek(P.L, 1)
      if (c1 === '{') {
        let d = 1
        advance(P.L)
        advance(P.L)
        while (P.L.i < P.L.len && d > 0) {
          const nc = peek(P.L)
          if (nc === '{') d++
          else if (nc === '}') d--
          advance(P.L)
        }
        continue
      }
      if (c1 === '(') {
        let d = 1
        advance(P.L)
        advance(P.L)
        while (P.L.i < P.L.len && d > 0) {
          const nc = peek(P.L)
          if (nc === '(') d++
          else if (nc === ')') d--
          advance(P.L)
        }
        continue
      }
    }
    advance(P.L)
  }
  flushRegex()
  while (peek(P.L) === '\n') advance(P.L)
  return out
}

function parseBacktick(P: ParseState): TsNode | null {
  const start = P.L.b
  advance(P.L)
  const open = mk(P, '`', start, P.L.b, [])
  P.inBacktick++
  // Parse statements inline — stop at closing backtick
  const body: TsNode[] = []
  while (true) {
    skipBlanks(P.L)
    if (peek(P.L) === '`' || peek(P.L) === '') break
    const save = saveLex(P.L)
    const t = nextToken(P.L, 'cmd')
    if (t.type === 'EOF' || t.type === 'BACKTICK') {
      restoreLex(P.L, save)
      break
    }
    if (t.type === 'NEWLINE') continue
    restoreLex(P.L, save)
    const stmt = parseAndOr(P)
    if (!stmt) break
    body.push(stmt)
    skipBlanks(P.L)
    if (peek(P.L) === '`') break
    const save2 = saveLex(P.L)
    const sep = nextToken(P.L, 'cmd')
    if (sep.type === 'OP' && (sep.value === ';' || sep.value === '&')) {
      body.push(leaf(P, sep.value, sep))
    } else if (sep.type !== 'NEWLINE') {
      restoreLex(P.L, save2)
    }
  }
  P.inBacktick--
  let close: TsNode
  if (peek(P.L) === '`') {
    const cStart = P.L.b
    advance(P.L)
    close = mk(P, '`', cStart, P.L.b, [])
  } else {
    close = mk(P, '`', P.L.b, P.L.b, [])
  }
  // Empty backticks (whitespace/newline only) are elided entirely by
  // tree-sitter — used as a line-continuation hack: "foo"`<newline>`"bar"
  // → (concatenation (string) (string)) with no command_substitution.
  if (body.length === 0) return null
  return mk(P, 'command_substitution', start, close.endIndex, [
    open,
    ...body,
    close,
  ])
}

function parseIf(P: ParseState, ifTok: Token): TsNode {
  const ifKw = leaf(P, 'if', ifTok)
  const kids: TsNode[] = [ifKw]
  const cond = parseStatements(P, null)
  kids.push(...cond)
  consumeKeyword(P, 'then', kids)
  const body = parseStatements(P, null)
  kids.push(...body)
  while (true) {
    const save = saveLex(P.L)
    const t = nextToken(P.L, 'cmd')
    if (t.type === 'WORD' && t.value === 'elif') {
      const eKw = leaf(P, 'elif', t)
      const eCond = parseStatements(P, null)
      const eKids: TsNode[] = [eKw, ...eCond]
      consumeKeyword(P, 'then', eKids)
      const eBody = parseStatements(P, null)
      eKids.push(...eBody)
      const last = eKids[eKids.length - 1]!
      kids.push(mk(P, 'elif_clause', eKw.startIndex, last.endIndex, eKids))
    } else if (t.type === 'WORD' && t.value === 'else') {
      const elKw = leaf(P, 'else', t)
      const elBody = parseStatements(P, null)
      const last = elBody.length > 0 ? elBody[elBody.length - 1]! : elKw
      kids.push(
        mk(P, 'else_clause', elKw.startIndex, last.endIndex, [elKw, ...elBody]),
      )
    } else {
      restoreLex(P.L, save)
      break
    }
  }
  consumeKeyword(P, 'fi', kids)
  const last = kids[kids.length - 1]!
  return mk(P, 'if_statement', ifKw.startIndex, last.endIndex, kids)
}

function parseWhile(P: ParseState, kwTok: Token): TsNode {
  const kw = leaf(P, kwTok.value, kwTok)
  const kids: TsNode[] = [kw]
  const cond = parseStatements(P, null)
  kids.push(...cond)
  const dg = parseDoGroup(P)
  if (dg) kids.push(dg)
  const last = kids[kids.length - 1]!
  return mk(P, 'while_statement', kw.startIndex, last.endIndex, kids)
}

function parseFor(P: ParseState, forTok: Token): TsNode {
  const forKw = leaf(P, forTok.value, forTok)
  skipBlanks(P.L)
  // C-style for (( ; ; )) — only for `for`, not `select`
  if (forTok.value === 'for' && peek(P.L) === '(' && peek(P.L, 1) === '(') {
    const oStart = P.L.b
    advance(P.L)
    advance(P.L)
    const open = mk(P, '((', oStart, P.L.b, [])
    const kids: TsNode[] = [forKw, open]
    // init; cond; update — all three use 'assign' mode so `c = expr` emits
    // variable_assignment, while bare idents (c in `c<=5`) → word. Each
    // clause may be a comma-separated list.
    for (let k = 0; k < 3; k++) {
      skipBlanks(P.L)
      const es = parseArithCommaList(P, k < 2 ? ';' : '))', 'assign')
      kids.push(...es)
      if (k < 2) {
        if (peek(P.L) === ';') {
          const s = P.L.b
          advance(P.L)
          kids.push(mk(P, ';', s, P.L.b, []))
        }
      }
    }
    skipBlanks(P.L)
    if (peek(P.L) === ')' && peek(P.L, 1) === ')') {
      const cStart = P.L.b
      advance(P.L)
      advance(P.L)
      kids.push(mk(P, '))', cStart, P.L.b, []))
    }
    // Optional ; or newline
    const save = saveLex(P.L)
    const sep = nextToken(P.L, 'cmd')
    if (sep.type === 'OP' && sep.value === ';') {
      kids.push(leaf(P, ';', sep))
    } else if (sep.type !== 'NEWLINE') {
      restoreLex(P.L, save)
    }
    const dg = parseDoGroup(P)
    if (dg) {
      kids.push(dg)
    } else {
      // C-style for can also use `{ ... }` body instead of `do ... done`
      skipNewlines(P)
      skipBlanks(P.L)
      if (peek(P.L) === '{') {
        const bOpen = P.L.b
        advance(P.L)
        const brace = mk(P, '{', bOpen, P.L.b, [])
        const body = parseStatements(P, '}')
        let bClose: TsNode
        if (peek(P.L) === '}') {
          const cs = P.L.b
          advance(P.L)
          bClose = mk(P, '}', cs, P.L.b, [])
        } else {
          bClose = mk(P, '}', P.L.b, P.L.b, [])
        }
        kids.push(
          mk(P, 'compound_statement', brace.startIndex, bClose.endIndex, [
            brace,
            ...body,
            bClose,
          ]),
        )
      }
    }
    const last = kids[kids.length - 1]!
    return mk(P, 'c_style_for_statement', forKw.startIndex, last.endIndex, kids)
  }
  // Regular for VAR in words; do ... done
  const kids: TsNode[] = [forKw]
  const varTok = nextToken(P.L, 'arg')
  kids.push(mk(P, 'variable_name', varTok.start, varTok.end, []))
  skipBlanks(P.L)
  const save = saveLex(P.L)
  const inTok = nextToken(P.L, 'arg')
  if (inTok.type === 'WORD' && inTok.value === 'in') {
    kids.push(leaf(P, 'in', inTok))
    while (true) {
      skipBlanks(P.L)
      const c = peek(P.L)
      if (c === ';' || c === '\n' || c === '') break
      const w = parseWord(P, 'arg')
      if (!w) break
      kids.push(w)
    }
  } else {
    restoreLex(P.L, save)
  }
  // Separator
  const save2 = saveLex(P.L)
  const sep = nextToken(P.L, 'cmd')
  if (sep.type === 'OP' && sep.value === ';') {
    kids.push(leaf(P, ';', sep))
  } else if (sep.type !== 'NEWLINE') {
    restoreLex(P.L, save2)
  }
  const dg = parseDoGroup(P)
  if (dg) kids.push(dg)
  const last = kids[kids.length - 1]!
  return mk(P, 'for_statement', forKw.startIndex, last.endIndex, kids)
}

function parseDoGroup(P: ParseState): TsNode | null {
  skipNewlines(P)
  const save = saveLex(P.L)
  const doTok = nextToken(P.L, 'cmd')
  if (doTok.type !== 'WORD' || doTok.value !== 'do') {
    restoreLex(P.L, save)
    return null
  }
  const doKw = leaf(P, 'do', doTok)
  const body = parseStatements(P, null)
  const kids: TsNode[] = [doKw, ...body]
  consumeKeyword(P, 'done', kids)
  const last = kids[kids.length - 1]!
  return mk(P, 'do_group', doKw.startIndex, last.endIndex, kids)
}

function parseCase(P: ParseState, caseTok: Token): TsNode {
  const caseKw = leaf(P, 'case', caseTok)
  const kids: TsNode[] = [caseKw]
  skipBlanks(P.L)
  const word = parseWord(P, 'arg')
  if (word) kids.push(word)
  skipBlanks(P.L)
  consumeKeyword(P, 'in', kids)
  skipNewlines(P)
  while (true) {
    skipBlanks(P.L)
    skipNewlines(P)
    const save = saveLex(P.L)
    const t = nextToken(P.L, 'arg')
    if (t.type === 'WORD' && t.value === 'esac') {
      kids.push(leaf(P, 'esac', t))
      break
    }
    if (t.type === 'EOF') break
    restoreLex(P.L, save)
    const item = parseCaseItem(P)
    if (!item) break
    kids.push(item)
  }
  const last = kids[kids.length - 1]!
  return mk(P, 'case_statement', caseKw.startIndex, last.endIndex, kids)
}

function parseCaseItem(P: ParseState): TsNode | null {
  skipBlanks(P.L)
  const start = P.L.b
  const kids: TsNode[] = []
  // Optional leading '(' before pattern — bash allows (pattern) syntax
  if (peek(P.L) === '(') {
    const s = P.L.b
    advance(P.L)
    kids.push(mk(P, '(', s, P.L.b, []))
  }
  // Pattern(s)
  let isFirstAlt = true
  while (true) {
    skipBlanks(P.L)
    const c = peek(P.L)
    if (c === ')' || c === '') break
    const pats = parseCasePattern(P)
    if (pats.length === 0) break
    // tree-sitter quirk: first alternative with quotes is inlined as flat
    // siblings; subsequent alternatives are wrapped in (concatenation) with
    // `word` instead of `extglob_pattern` for bare segments.
    if (!isFirstAlt && pats.length > 1) {
      const rewritten = pats.map(p =>
        p.type === 'extglob_pattern'
          ? mk(P, 'word', p.startIndex, p.endIndex, [])
          : p,
      )
      const first = rewritten[0]!
      const last = rewritten[rewritten.length - 1]!
      kids.push(
        mk(P, 'concatenation', first.startIndex, last.endIndex, rewritten),
      )
    } else {
      kids.push(...pats)
    }
    isFirstAlt = false
    skipBlanks(P.L)
    // \<newline> line continuation between alternatives
    if (peek(P.L) === '\\' && peek(P.L, 1) === '\n') {
      advance(P.L)
      advance(P.L)
      skipBlanks(P.L)
    }
    if (peek(P.L) === '|') {
      const s = P.L.b
      advance(P.L)
      kids.push(mk(P, '|', s, P.L.b, []))
      // \<newline> after | is also a line continuation
      if (peek(P.L) === '\\' && peek(P.L, 1) === '\n') {
        advance(P.L)
        advance(P.L)
      }
    } else {
      break
    }
  }
  if (peek(P.L) === ')') {
    const s = P.L.b
    advance(P.L)
    kids.push(mk(P, ')', s, P.L.b, []))
  }
  const body = parseStatements(P, null)
  kids.push(...body)
  const save = saveLex(P.L)
  const term = nextToken(P.L, 'cmd')
  if (
    term.type === 'OP' &&
    (term.value === ';;' || term.value === ';&' || term.value === ';;&')
  ) {
    kids.push(leaf(P, term.value, term))
  } else {
    restoreLex(P.L, save)
  }
  if (kids.length === 0) return null
  // tree-sitter quirk: case_item with EMPTY body and a single pattern matching
  // extglob-operator-char-prefix (no actual glob metachars) downgrades to word.
  // `-o) owner=$2 ;;` (has body) → extglob_pattern; `-g) ;;` (empty) → word.
  if (body.length === 0) {
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i]!
      if (k.type !== 'extglob_pattern') continue
      const text = sliceBytes(P, k.startIndex, k.endIndex)
      if (/^[-+?*@!][a-zA-Z]/.test(text) && !/[*?(]/.test(text)) {
        kids[i] = mk(P, 'word', k.startIndex, k.endIndex, [])
      }
    }
  }
  const last = kids[kids.length - 1]!
  return mk(P, 'case_item', start, last.endIndex, kids)
}

function parseCasePattern(P: ParseState): TsNode[] {
  skipBlanks(P.L)
  const save = saveLex(P.L)
  const start = P.L.b
  const startI = P.L.i
  let parenDepth = 0
  let hasDollar = false
  let hasBracketOutsideParen = false
  let hasQuote = false
  while (P.L.i < P.L.len) {
    const c = peek(P.L)
    if (c === '\\' && P.L.i + 1 < P.L.len) {
      // Escaped char — consume both (handles `bar\ baz` as single pattern)
      // \<newline> is a line continuation; eat it but stay in pattern.
      advance(P.L)
      advance(P.L)
      continue
    }
    if (c === '"' || c === "'") {
      hasQuote = true
      // Skip past the quoted segment so its content (spaces, |, etc.) doesn't
      // break the peek-ahead scan.
      advance(P.L)
      while (P.L.i < P.L.len && peek(P.L) !== c) {
        if (peek(P.L) === '\\' && P.L.i + 1 < P.L.len) advance(P.L)
        advance(P.L)
      }
      if (peek(P.L) === c) advance(P.L)
      continue
    }
    // Paren counting: any ( inside pattern opens a scope; don't break at ) or |
    // until balanced. Handles extglob *(a|b) and nested shapes *([0-9])([0-9]).
    if (c === '(') {
      parenDepth++
      advance(P.L)
      continue
    }
    if (parenDepth > 0) {
      if (c === ')') {
        parenDepth--
        advance(P.L)
        continue
      }
      if (c === '\n') break
      advance(P.L)
      continue
    }
    if (c === ')' || c === '|' || c === ' ' || c === '\t' || c === '\n') break
    if (c === '$') hasDollar = true
    if (c === '[') hasBracketOutsideParen = true
    advance(P.L)
  }
  if (P.L.b === start) return []
  const text = P.src.slice(startI, P.L.i)
  const hasExtglobParen = /[*?+@!]\(/.test(text)
  // Quoted segments in pattern: tree-sitter splits at quote boundaries into
  // multiple sibling nodes. `*"foo"*` → (extglob_pattern)(string)(extglob_pattern).
  // Re-scan with a segmenting pass.
  if (hasQuote && !hasExtglobParen) {
    restoreLex(P.L, save)
    return parseCasePatternSegmented(P)
  }
  // tree-sitter splits patterns with [ or $ into concatenation via word parsing
  // UNLESS pattern has extglob parens (those override and emit extglob_pattern).
  // `*.[1357]` → concat(word word number word); `${PN}.pot` → concat(expansion word);
  // but `*([0-9])` → extglob_pattern (has extglob paren).
  if (!hasExtglobParen && (hasDollar || hasBracketOutsideParen)) {
    restoreLex(P.L, save)
    const w = parseWord(P, 'arg')
    return w ? [w] : []
  }
  // Patterns starting with extglob operator chars (+ - ? * @ !) followed by
  // identifier chars are extglob_pattern per tree-sitter, even without parens
  // or glob metachars. `-o)` → extglob_pattern; plain `foo)` → word.
  const type =
    hasExtglobParen || /[*?]/.test(text) || /^[-+?*@!][a-zA-Z]/.test(text)
      ? 'extglob_pattern'
      : 'word'
  return [mk(P, type, start, P.L.b, [])]
}

// Segmented scan for case patterns containing quotes: `*"foo"*` →
// [extglob_pattern, string, extglob_pattern]. Bare segments → extglob_pattern
// if they have */?, else word. Stops at ) | space tab newline outside quotes.
function parseCasePatternSegmented(P: ParseState): TsNode[] {
  const parts: TsNode[] = []
  let segStart = P.L.b
  let segStartI = P.L.i
  const flushSeg = (): void => {
    if (P.L.i > segStartI) {
      const t = P.src.slice(segStartI, P.L.i)
      const type = /[*?]/.test(t) ? 'extglob_pattern' : 'word'
      parts.push(mk(P, type, segStart, P.L.b, []))
    }
  }
  while (P.L.i < P.L.len) {
    const c = peek(P.L)
    if (c === '\\' && P.L.i + 1 < P.L.len) {
      advance(P.L)
      advance(P.L)
      continue
    }
    if (c === '"') {
      flushSeg()
      parts.push(parseDoubleQuoted(P))
      segStart = P.L.b
      segStartI = P.L.i
      continue
    }
    if (c === "'") {
      flushSeg()
      const tok = nextToken(P.L, 'arg')
      parts.push(leaf(P, 'raw_string', tok))
      segStart = P.L.b
      segStartI = P.L.i
      continue
    }
    if (c === ')' || c === '|' || c === ' ' || c === '\t' || c === '\n') break
    advance(P.L)
  }
  flushSeg()
  return parts
}

function parseFunction(P: ParseState, fnTok: Token): TsNode {
  const fnKw = leaf(P, 'function', fnTok)
  skipBlanks(P.L)
  const nameTok = nextToken(P.L, 'arg')
  const name = mk(P, 'word', nameTok.start, nameTok.end, [])
  const kids: TsNode[] = [fnKw, name]
  skipBlanks(P.L)
  if (peek(P.L) === '(' && peek(P.L, 1) === ')') {
    const o = nextToken(P.L, 'cmd')
    const c = nextToken(P.L, 'cmd')
    kids.push(leaf(P, '(', o))
    kids.push(leaf(P, ')', c))
  }
  skipBlanks(P.L)
  skipNewlines(P)
  const body = parseCommand(P)
  if (body) {
    // Hoist redirects from redirected_statement(compound_statement, ...) to
    // function_definition level per tree-sitter grammar
    if (
      body.type === 'redirected_statement' &&
      body.children.length >= 2 &&
      body.children[0]!.type === 'compound_statement'
    ) {
      kids.push(...body.children)
    } else {
      kids.push(body)
    }
  }
  const last = kids[kids.length - 1]!
  return mk(P, 'function_definition', fnKw.startIndex, last.endIndex, kids)
}

function parseDeclaration(P: ParseState, kwTok: Token): TsNode {
  const kw = leaf(P, kwTok.value, kwTok)
  const kids: TsNode[] = [kw]
  while (true) {
    skipBlanks(P.L)
    const c = peek(P.L)
    if (
      c === '' ||
      c === '\n' ||
      c === ';' ||
      c === '&' ||
      c === '|' ||
      c === ')' ||
      c === '<' ||
      c === '>'
    ) {
      break
    }
    const a = tryParseAssignment(P)
    if (a) {
      kids.push(a)
      continue
    }
    // Quoted string or concatenation: `export "FOO=bar"`, `export 'X'`
    if (c === '"' || c === "'" || c === '$') {
      const w = parseWord(P, 'arg')
      if (w) {
        kids.push(w)
        continue
      }
      break
    }
    // Flag like -a or bare variable name
    const save = saveLex(P.L)
    const tok = nextToken(P.L, 'arg')
    if (tok.type === 'WORD' || tok.type === 'NUMBER') {
      if (tok.value.startsWith('-')) {
        kids.push(leaf(P, 'word', tok))
      } else if (isIdentStart(tok.value[0] ?? '')) {
        kids.push(mk(P, 'variable_name', tok.start, tok.end, []))
      } else {
        kids.push(leaf(P, 'word', tok))
      }
    } else {
      restoreLex(P.L, save)
      break
    }
  }
  const last = kids[kids.length - 1]!
  return mk(P, 'declaration_command', kw.startIndex, last.endIndex, kids)
}

function parseUnset(P: ParseState, kwTok: Token): TsNode {
  const kw = leaf(P, 'unset', kwTok)
  const kids: TsNode[] = [kw]
  while (true) {
    skipBlanks(P.L)
    const c = peek(P.L)
    if (
      c === '' ||
      c === '\n' ||
      c === ';' ||
      c === '&' ||
      c === '|' ||
      c === ')' ||
      c === '<' ||
      c === '>'
    ) {
      break
    }
    // SECURITY: use parseWord (not raw nextToken) so quoted strings like
    // `unset 'a[$(id)]'` emit a raw_string child that ast.ts can reject.
    // Previously `break` silently dropped non-WORD args — hiding the
    // arithmetic-subscript code-exec vector from the security walker.
    const arg = parseWord(P, 'arg')
    if (!arg) break
    if (arg.type === 'word') {
      if (arg.text.startsWith('-')) {
        kids.push(arg)
      } else {
        kids.push(mk(P, 'variable_name', arg.startIndex, arg.endIndex, []))
      }
    } else {
      kids.push(arg)
    }
  }
  const last = kids[kids.length - 1]!
  return mk(P, 'unset_command', kw.startIndex, last.endIndex, kids)
}

function consumeKeyword(P: ParseState, name: string, kids: TsNode[]): void {
  skipNewlines(P)
  const save = saveLex(P.L)
  const t = nextToken(P.L, 'cmd')
  if (t.type === 'WORD' && t.value === name) {
    kids.push(leaf(P, name, t))
  } else {
    restoreLex(P.L, save)
  }
}

// ───────────────────── Test & Arithmetic Expressions ─────────────────────

function parseTestExpr(P: ParseState, closer: string): TsNode | null {
  return parseTestOr(P, closer)
}

function parseTestOr(P: ParseState, closer: string): TsNode | null {
  let left = parseTestAnd(P, closer)
  if (!left) return null
  while (true) {
    skipBlanks(P.L)
    const save = saveLex(P.L)
    if (peek(P.L) === '|' && peek(P.L, 1) === '|') {
      const s = P.L.b
      advance(P.L)
      advance(P.L)
      const op = mk(P, '||', s, P.L.b, [])
      const right = parseTestAnd(P, closer)
      if (!right) {
        restoreLex(P.L, save)
        break
      }
      left = mk(P, 'binary_expression', left.startIndex, right.endIndex, [
        left,
        op,
        right,
      ])
    } else {
      break
    }
  }
  return left
}

function parseTestAnd(P: ParseState, closer: string): TsNode | null {
  let left = parseTestUnary(P, closer)
  if (!left) return null
  while (true) {
    skipBlanks(P.L)
    if (peek(P.L) === '&' && peek(P.L, 1) === '&') {
      const s = P.L.b
      advance(P.L)
      advance(P.L)
      const op = mk(P, '&&', s, P.L.b, [])
      const right = parseTestUnary(P, closer)
      if (!right) break
      left = mk(P, 'binary_expression', left.startIndex, right.endIndex, [
        left,
        op,
        right,
      ])
    } else {
      break
    }
  }
  return left
}

function parseTestUnary(P: ParseState, closer: string): TsNode | null {
  skipBlanks(P.L)
  const c = peek(P.L)
  if (c === '(') {
    const s = P.L.b
    advance(P.L)
    const open = mk(P, '(', s, P.L.b, [])
    const inner = parseTestOr(P, closer)
    skipBlanks(P.L)
    let close: TsNode
    if (peek(P.L) === ')') {
      const cs = P.L.b
      advance(P.L)
      close = mk(P, ')', cs, P.L.b, [])
    } else {
      close = mk(P, ')', P.L.b, P.L.b, [])
    }
    const kids = inner ? [open, inner, close] : [open, close]
    return mk(
      P,
      'parenthesized_expression',
      open.startIndex,
      close.endIndex,
      kids,
    )
  }
  return parseTestBinary(P, closer)
}

/**
 * Parse `!`-negated or test-operator (`-f`) or parenthesized primary — but NOT
 * a binary comparison. Used as LHS of binary_expression so `! x =~ y` binds
 * `!` to `x` only, not the whole `x =~ y`.
 */
function parseTestNegatablePrimary(
  P: ParseState,
  closer: string,
): TsNode | null {
  skipBlanks(P.L)
  const c = peek(P.L)
  if (c === '!') {
    const s = P.L.b
    advance(P.L)
    const bang = mk(P, '!', s, P.L.b, [])
    const inner = parseTestNegatablePrimary(P, closer)
    if (!inner) return bang
    return mk(P, 'unary_expression', bang.startIndex, inner.endIndex, [
      bang,
      inner,
    ])
  }
  if (c === '-' && isIdentStart(peek(P.L, 1))) {
    const s = P.L.b
    advance(P.L)
    while (isIdentChar(peek(P.L))) advance(P.L)
    const op = mk(P, 'test_operator', s, P.L.b, [])
    skipBlanks(P.L)
    const arg = parseTestPrimary(P, closer)
    if (!arg) return op
    return mk(P, 'unary_expression', op.startIndex, arg.endIndex, [op, arg])
  }
  return parseTestPrimary(P, closer)
}

function parseTestBinary(P: ParseState, closer: string): TsNode | null {
  skipBlanks(P.L)
  // `!` in test context binds tighter than =~/==.
  // `[[ ! "x" =~ y ]]` → (binary_expression (unary_expression (string)) (regex))
  // `[[ ! -f x ]]` → (unary_expression ! (unary_expression (test_operator) (word)))
  const left = parseTestNegatablePrimary(P, closer)
  if (!left) return null
  skipBlanks(P.L)
  // Binary comparison: == != =~ -eq -lt etc.
  const c = peek(P.L)
  const c1 = peek(P.L, 1)
  let op: TsNode | null = null
  const os = P.L.b
  if (c === '=' && c1 === '=') {
    advance(P.L)
    advance(P.L)
    op = mk(P, '==', os, P.L.b, [])
  } else if (c === '!' && c1 === '=') {
    advance(P.L)
    advance(P.L)
    op = mk(P, '!=', os, P.L.b, [])
  } else if (c === '=' && c1 === '~') {
    advance(P.L)
    advance(P.L)
    op = mk(P, '=~', os, P.L.b, [])
  } else if (c === '=' && c1 !== '=') {
    advance(P.L)
    op = mk(P, '=', os, P.L.b, [])
  } else if (c === '<' && c1 !== '<') {
    advance(P.L)
    op = mk(P, '<', os, P.L.b, [])
  } else if (c === '>' && c1 !== '>') {
    advance(P.L)
    op = mk(P, '>', os, P.L.b, [])
  } else if (c === '-' && isIdentStart(c1)) {
    advance(P.L)
    while (isIdentChar(peek(P.L))) advance(P.L)
    op = mk(P, 'test_operator', os, P.L.b, [])
  }
  if (!op) return left
  skipBlanks(P.L)
  // In [[ ]], RHS of ==/!=/=/=~ gets special pattern parsing: paren counting
  // so @(a|b|c) doesn't break on |, and segments become extglob_pattern/regex.
  if (closer === ']]') {
    const opText = op.type
    if (opText === '=~') {
      skipBlanks(P.L)
      // If the ENTIRE RHS is a quoted string, emit string/raw_string not
      // regex: `[[ "$x" =~ "$y" ]]` → (binary_expression (string) (string)).
      // If there's content after the quote (`' boop '(.*)$`), the whole RHS
      // stays a single (regex). Peek past the quote to check.
      const rc = peek(P.L)
      let rhs: TsNode | null = null
      if (rc === '"' || rc === "'") {
        const save = saveLex(P.L)
        const quoted =
          rc === '"'
            ? parseDoubleQuoted(P)
            : leaf(P, 'raw_string', nextToken(P.L, 'arg'))
        // Check if RHS ends here: only whitespace then ]] or &&/|| or newline
        let j = P.L.i
        while (j < P.L.len && (P.src[j] === ' ' || P.src[j] === '\t')) j++
        const nc = P.src[j] ?? ''
        const nc1 = P.src[j + 1] ?? ''
        if (
          (nc === ']' && nc1 === ']') ||
          (nc === '&' && nc1 === '&') ||
          (nc === '|' && nc1 === '|') ||
          nc === '\n' ||
          nc === ''
        ) {
          rhs = quoted
        } else {
          restoreLex(P.L, save)
        }
      }
      if (!rhs) rhs = parseTestRegexRhs(P)
      if (!rhs) return left
      return mk(P, 'binary_expression', left.startIndex, rhs.endIndex, [
        left,
        op,
        rhs,
      ])
    }
    // Single `=` emits (regex) per tree-sitter; `==` and `!=` emit extglob_pattern
    if (opText === '=') {
      const rhs = parseTestRegexRhs(P)
      if (!rhs) return left
      return mk(P, 'binary_expression', left.startIndex, rhs.endIndex, [
        left,
        op,
        rhs,
      ])
    }
    if (opText === '==' || opText === '!=') {
      const parts = parseTestExtglobRhs(P)
      if (parts.length === 0) return left
      const last = parts[parts.length - 1]!
      return mk(P, 'binary_expression', left.startIndex, last.endIndex, [
        left,
        op,
        ...parts,
      ])
    }
  }
  const right = parseTestPrimary(P, closer)
  if (!right) return left
  return mk(P, 'binary_expression', left.startIndex, right.endIndex, [
    left,
    op,
    right,
  ])
}

// RHS of =~ in [[ ]] — scan as single (regex) node with paren/bracket counting
// so | ( ) inside the regex don't break parsing. Stop at ]] or ws+&&/||.
function parseTestRegexRhs(P: ParseState): TsNode | null {
  skipBlanks(P.L)
  const start = P.L.b
  let parenDepth = 0
  let bracketDepth = 0
  while (P.L.i < P.L.len) {
    const c = peek(P.L)
    if (c === '\\' && P.L.i + 1 < P.L.len) {
      advance(P.L)
      advance(P.L)
      continue
    }
    if (c === '\n') break
    if (parenDepth === 0 && bracketDepth === 0) {
      if (c === ']' && peek(P.L, 1) === ']') break
      if (c === ' ' || c === '\t') {
        // Peek past blanks for ]] or &&/||
        let j = P.L.i
        while (j < P.L.len && (P.L.src[j] === ' ' || P.L.src[j] === '\t')) j++
        const nc = P.L.src[j] ?? ''
        const nc1 = P.L.src[j + 1] ?? ''
        if (
          (nc === ']' && nc1 === ']') ||
          (nc === '&' && nc1 === '&') ||
          (nc === '|' && nc1 === '|')
        ) {
          break
        }
        advance(P.L)
        continue
      }
    }
    if (c === '(') parenDepth++
    else if (c === ')' && parenDepth > 0) parenDepth--
    else if (c === '[') bracketDepth++
    else if (c === ']' && bracketDepth > 0) bracketDepth--
    advance(P.L)
  }
  if (P.L.b === start) return null
  return mk(P, 'regex', start, P.L.b, [])
}

// RHS of ==/!=/= in [[ ]] — returns array of parts. Bare text → extglob_pattern
// (with paren counting for @(a|b)); $(...)/${}/quoted → proper node types.
// Multiple parts become flat children of binary_expression per tree-sitter.
function parseTestExtglobRhs(P: ParseState): TsNode[] {
  skipBlanks(P.L)
  const parts: TsNode[] = []
  let segStart = P.L.b
  let segStartI = P.L.i
  let parenDepth = 0
  const flushSeg = () => {
    if (P.L.i > segStartI) {
      const text = P.src.slice(segStartI, P.L.i)
      // Pure number stays number; everything else is extglob_pattern
      const type = /^\d+$/.test(text) ? 'number' : 'extglob_pattern'
      parts.push(mk(P, type, segStart, P.L.b, []))
    }
  }
  while (P.L.i < P.L.len) {
    const c = peek(P.L)
    if (c === '\\' && P.L.i + 1 < P.L.len) {
      advance(P.L)
      advance(P.L)
      continue
    }
    if (c === '\n') break
    if (parenDepth === 0) {
      if (c === ']' && peek(P.L, 1) === ']') break
      if (c === ' ' || c === '\t') {
        let j = P.L.i
        while (j < P.L.len && (P.L.src[j] === ' ' || P.L.src[j] === '\t')) j++
        const nc = P.L.src[j] ?? ''
        const nc1 = P.L.src[j + 1] ?? ''
        if (
          (nc === ']' && nc1 === ']') ||
          (nc === '&' && nc1 === '&') ||
          (nc === '|' && nc1 === '|')
        ) {
          break
        }
        advance(P.L)
        continue
      }
    }
    // $ " ' must be parsed even inside @( ) extglob parens — parseDollarLike
    // consumes matching ) so parenDepth stays consistent.
    if (c === '$') {
      const c1 = peek(P.L, 1)
      if (
        c1 === '(' ||
        c1 === '{' ||
        isIdentStart(c1) ||
        SPECIAL_VARS.has(c1)
      ) {
        flushSeg()
        const exp = parseDollarLike(P)
        if (exp) parts.push(exp)
        segStart = P.L.b
        segStartI = P.L.i
        continue
      }
    }
    if (c === '"') {
      flushSeg()
      parts.push(parseDoubleQuoted(P))
      segStart = P.L.b
      segStartI = P.L.i
      continue
    }
    if (c === "'") {
      flushSeg()
      const tok = nextToken(P.L, 'arg')
      parts.push(leaf(P, 'raw_string', tok))
      segStart = P.L.b
      segStartI = P.L.i
      continue
    }
    if (c === '(') parenDepth++
    else if (c === ')' && parenDepth > 0) parenDepth--
    advance(P.L)
  }
  flushSeg()
  return parts
}

function parseTestPrimary(P: ParseState, closer: string): TsNode | null {
  skipBlanks(P.L)
  // Stop at closer
  if (closer === ']' && peek(P.L) === ']') return null
  if (closer === ']]' && peek(P.L) === ']' && peek(P.L, 1) === ']') return null
  return parseWord(P, 'arg')
}

/**
 * Arithmetic context modes:
 * - 'var': bare identifiers → variable_name (default, used in $((..)), ((..)))
 * - 'word': bare identifiers → word (c-style for head condition/update clauses)
 * - 'assign': identifiers with = → variable_assignment (c-style for init clause)
 */
type ArithMode = 'var' | 'word' | 'assign'

/** Operator precedence table (higher = tighter binding). */
const ARITH_PREC: Record<string, number> = {
  '=': 2,
  '+=': 2,
  '-=': 2,
  '*=': 2,
  '/=': 2,
  '%=': 2,
  '<<=': 2,
  '>>=': 2,
  '&=': 2,
  '^=': 2,
  '|=': 2,
  '||': 4,
  '&&': 5,
  '|': 6,
  '^': 7,
  '&': 8,
  '==': 9,
  '!=': 9,
  '<': 10,
  '>': 10,
  '<=': 10,
  '>=': 10,
  '<<': 11,
  '>>': 11,
  '+': 12,
  '-': 12,
  '*': 13,
  '/': 13,
  '%': 13,
  '**': 14,
}

/** Right-associative operators (assignment and exponent). */
const ARITH_RIGHT_ASSOC = new Set([
  '=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '<<=',
  '>>=',
  '&=',
  '^=',
  '|=',
  '**',
])

function parseArithExpr(
  P: ParseState,
  stop: string,
  mode: ArithMode = 'var',
): TsNode | null {
  return parseArithTernary(P, stop, mode)
}

/** Top-level: comma-separated list. arithmetic_expansion emits multiple children. */
function parseArithCommaList(
  P: ParseState,
  stop: string,
  mode: ArithMode = 'var',
): TsNode[] {
  const out: TsNode[] = []
  while (true) {
    const e = parseArithTernary(P, stop, mode)
    if (e) out.push(e)
    skipBlanks(P.L)
    if (peek(P.L) === ',' && !isArithStop(P, stop)) {
      advance(P.L)
      continue
    }
    break
  }
  return out
}

function parseArithTernary(
  P: ParseState,
  stop: string,
  mode: ArithMode,
): TsNode | null {
  const cond = parseArithBinary(P, stop, 0, mode)
  if (!cond) return null
  skipBlanks(P.L)
  if (peek(P.L) === '?') {
    const qs = P.L.b
    advance(P.L)
    const q = mk(P, '?', qs, P.L.b, [])
    const t = parseArithBinary(P, ':', 0, mode)
    skipBlanks(P.L)
    let colon: TsNode
    if (peek(P.L) === ':') {
      const cs = P.L.b
      advance(P.L)
      colon = mk(P, ':', cs, P.L.b, [])
    } else {
      colon = mk(P, ':', P.L.b, P.L.b, [])
    }
    const f = parseArithTernary(P, stop, mode)
    const last = f ?? colon
    const kids: TsNode[] = [cond, q]
    if (t) kids.push(t)
    kids.push(colon)
    if (f) kids.push(f)
    return mk(P, 'ternary_expression', cond.startIndex, last.endIndex, kids)
  }
  return cond
}

/** Scan next arithmetic binary operator; returns [text, length] or null. */
function scanArithOp(P: ParseState): [string, number] | null {
  const c = peek(P.L)
  const c1 = peek(P.L, 1)
  const c2 = peek(P.L, 2)
  // 3-char: <<= >>=
  if (c === '<' && c1 === '<' && c2 === '=') return ['<<=', 3]
  if (c === '>' && c1 === '>' && c2 === '=') return ['>>=', 3]
  // 2-char
  if (c === '*' && c1 === '*') return ['**', 2]
  if (c === '<' && c1 === '<') return ['<<', 2]
  if (c === '>' && c1 === '>') return ['>>', 2]
  if (c === '=' && c1 === '=') return ['==', 2]
  if (c === '!' && c1 === '=') return ['!=', 2]
  if (c === '<' && c1 === '=') return ['<=', 2]
  if (c === '>' && c1 === '=') return ['>=', 2]
  if (c === '&' && c1 === '&') return ['&&', 2]
  if (c === '|' && c1 === '|') return ['||', 2]
  if (c === '+' && c1 === '=') return ['+=', 2]
  if (c === '-' && c1 === '=') return ['-=', 2]
  if (c === '*' && c1 === '=') return ['*=', 2]
  if (c === '/' && c1 === '=') return ['/=', 2]
  if (c === '%' && c1 === '=') return ['%=', 2]
  if (c === '&' && c1 === '=') return ['&=', 2]
  if (c === '^' && c1 === '=') return ['^=', 2]
  if (c === '|' && c1 === '=') return ['|=', 2]
  // 1-char — but NOT ++ -- (those are pre/postfix)
  if (c === '+' && c1 !== '+') return ['+', 1]
  if (c === '-' && c1 !== '-') return ['-', 1]
  if (c === '*') return ['*', 1]
  if (c === '/') return ['/', 1]
  if (c === '%') return ['%', 1]
  if (c === '<') return ['<', 1]
  if (c === '>') return ['>', 1]
  if (c === '&') return ['&', 1]
  if (c === '|') return ['|', 1]
  if (c === '^') return ['^', 1]
  if (c === '=') return ['=', 1]
  return null
}

/** Precedence-climbing binary expression parser. */
function parseArithBinary(
  P: ParseState,
  stop: string,
  minPrec: number,
  mode: ArithMode,
): TsNode | null {
  let left = parseArithUnary(P, stop, mode)
  if (!left) return null
  while (true) {
    skipBlanks(P.L)
    if (isArithStop(P, stop)) break
    if (peek(P.L) === ',') break
    const opInfo = scanArithOp(P)
    if (!opInfo) break
    const [opText, opLen] = opInfo
    const prec = ARITH_PREC[opText]
    if (prec === undefined || prec < minPrec) break
    const os = P.L.b
    for (let k = 0; k < opLen; k++) advance(P.L)
    const op = mk(P, opText, os, P.L.b, [])
    const nextMin = ARITH_RIGHT_ASSOC.has(opText) ? prec : prec + 1
    const right = parseArithBinary(P, stop, nextMin, mode)
    if (!right) break
    left = mk(P, 'binary_expression', left.startIndex, right.endIndex, [
      left,
      op,
      right,
    ])
  }
  return left
}

function parseArithUnary(
  P: ParseState,
  stop: string,
  mode: ArithMode,
): TsNode | null {
  skipBlanks(P.L)
  if (isArithStop(P, stop)) return null
  const c = peek(P.L)
  const c1 = peek(P.L, 1)
  // Prefix ++ --
  if ((c === '+' && c1 === '+') || (c === '-' && c1 === '-')) {
    const s = P.L.b
    advance(P.L)
    advance(P.L)
    const op = mk(P, c + c1, s, P.L.b, [])
    const inner = parseArithUnary(P, stop, mode)
    if (!inner) return op
    return mk(P, 'unary_expression', op.startIndex, inner.endIndex, [op, inner])
  }
  if (c === '-' || c === '+' || c === '!' || c === '~') {
    // In 'word'/'assign' mode (c-style for head), `-N` is a single number
    // literal per tree-sitter, not unary_expression. 'var' mode uses unary.
    if (mode !== 'var' && c === '-' && isDigit(c1)) {
      const s = P.L.b
      advance(P.L)
      while (isDigit(peek(P.L))) advance(P.L)
      return mk(P, 'number', s, P.L.b, [])
    }
    const s = P.L.b
    advance(P.L)
    const op = mk(P, c, s, P.L.b, [])
    const inner = parseArithUnary(P, stop, mode)
    if (!inner) return op
    return mk(P, 'unary_expression', op.startIndex, inner.endIndex, [op, inner])
  }
  return parseArithPostfix(P, stop, mode)
}

function parseArithPostfix(
  P: ParseState,
  stop: string,
  mode: ArithMode,
): TsNode | null {
  const prim = parseArithPrimary(P, stop, mode)
  if (!prim) return null
  const c = peek(P.L)
  const c1 = peek(P.L, 1)
  if ((c === '+' && c1 === '+') || (c === '-' && c1 === '-')) {
    const s = P.L.b
    advance(P.L)
    advance(P.L)
    const op = mk(P, c + c1, s, P.L.b, [])
    return mk(P, 'postfix_expression', prim.startIndex, op.endIndex, [prim, op])
  }
  return prim
}

function parseArithPrimary(
  P: ParseState,
  stop: string,
  mode: ArithMode,
): TsNode | null {
  skipBlanks(P.L)
  if (isArithStop(P, stop)) return null
  const c = peek(P.L)
  if (c === '(') {
    const s = P.L.b
    advance(P.L)
    const open = mk(P, '(', s, P.L.b, [])
    // Parenthesized expression may contain comma-separated exprs
    const inners = parseArithCommaList(P, ')', mode)
    skipBlanks(P.L)
    let close: TsNode
    if (peek(P.L) === ')') {
      const cs = P.L.b
      advance(P.L)
      close = mk(P, ')', cs, P.L.b, [])
    } else {
      close = mk(P, ')', P.L.b, P.L.b, [])
    }
    return mk(P, 'parenthesized_expression', open.startIndex, close.endIndex, [
      open,
      ...inners,
      close,
    ])
  }
  if (c === '"') {
    return parseDoubleQuoted(P)
  }
  if (c === '$') {
    return parseDollarLike(P)
  }
  if (isDigit(c)) {
    const s = P.L.b
    while (isDigit(peek(P.L))) advance(P.L)
    // Hex: 0x1f
    if (
      P.L.b - s === 1 &&
      c === '0' &&
      (peek(P.L) === 'x' || peek(P.L) === 'X')
    ) {
      advance(P.L)
      while (isHexDigit(peek(P.L))) advance(P.L)
    }
    // Base notation: BASE#DIGITS e.g. 2#1010, 16#ff
    else if (peek(P.L) === '#') {
      advance(P.L)
      while (isBaseDigit(peek(P.L))) advance(P.L)
    }
    return mk(P, 'number', s, P.L.b, [])
  }
  if (isIdentStart(c)) {
    const s = P.L.b
    while (isIdentChar(peek(P.L))) advance(P.L)
    const nc = peek(P.L)
    // Assignment in 'assign' mode (c-style for init): emit variable_assignment
    // so chained `a = b = c = 1` nests correctly. Other modes treat `=` as a
    // binary_expression operator via the precedence table.
    if (mode === 'assign') {
      skipBlanks(P.L)
      const ac = peek(P.L)
      const ac1 = peek(P.L, 1)
      if (ac === '=' && ac1 !== '=') {
        const vn = mk(P, 'variable_name', s, P.L.b, [])
        const es = P.L.b
        advance(P.L)
        const eq = mk(P, '=', es, P.L.b, [])
        // RHS may itself be another assignment (chained)
        const val = parseArithTernary(P, stop, mode)
        const end = val ? val.endIndex : eq.endIndex
        const kids = val ? [vn, eq, val] : [vn, eq]
        return mk(P, 'variable_assignment', s, end, kids)
      }
    }
    // Subscript
    if (nc === '[') {
      const vn = mk(P, 'variable_name', s, P.L.b, [])
      const brS = P.L.b
      advance(P.L)
      const brOpen = mk(P, '[', brS, P.L.b, [])
      const idx = parseArithTernary(P, ']', 'var') ?? parseDollarLike(P)
      skipBlanks(P.L)
      let brClose: TsNode
      if (peek(P.L) === ']') {
        const cs = P.L.b
        advance(P.L)
        brClose = mk(P, ']', cs, P.L.b, [])
      } else {
        brClose = mk(P, ']', P.L.b, P.L.b, [])
      }
      const kids = idx ? [vn, brOpen, idx, brClose] : [vn, brOpen, brClose]
      return mk(P, 'subscript', s, brClose.endIndex, kids)
    }
    // Bare identifier: variable_name in 'var' mode, word in 'word'/'assign' mode.
    // 'assign' mode falls through to word when no `=` follows (c-style for
    // cond/update clauses: `c<=5` → binary_expression(word, number)).
    const identType = mode === 'var' ? 'variable_name' : 'word'
    return mk(P, identType, s, P.L.b, [])
  }
  return null
}

function isArithStop(P: ParseState, stop: string): boolean {
  const c = peek(P.L)
  if (stop === '))') return c === ')' && peek(P.L, 1) === ')'
  if (stop === ')') return c === ')'
  if (stop === ';') return c === ';'
  if (stop === ':') return c === ':'
  if (stop === ']') return c === ']'
  if (stop === '}') return c === '}'
  if (stop === ':}') return c === ':' || c === '}'
  return c === '' || c === '\n'
}
