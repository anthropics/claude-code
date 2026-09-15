// Shorthand (+500k) anchored to start/end to avoid false positives in natural language.
// Verbose (use/spend 2M tokens) matches anywhere.
const SHORTHAND_START_RE = /^\s*\+(\d+(?:\.\d+)?)\s*(k|m|b)\b/i
// Lookbehind (?<=\s) is avoided — it defeats YARR JIT in JSC, and the
// interpreter scans O(n) even with the $ anchor. Capture the whitespace
// instead; callers offset match.index by 1 where position matters.
const SHORTHAND_END_RE = /\s\+(\d+(?:\.\d+)?)\s*(k|m|b)\s*[.!?]?\s*$/i
const VERBOSE_RE = /\b(?:use|spend)\s+(\d+(?:\.\d+)?)\s*(k|m|b)\s*tokens?\b/i
const VERBOSE_RE_G = new RegExp(VERBOSE_RE.source, 'gi')

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
}

function parseBudgetMatch(value: string, suffix: string): number {
  return parseFloat(value) * MULTIPLIERS[suffix.toLowerCase()]!
}

export function parseTokenBudget(text: string): number | null {
  const startMatch = text.match(SHORTHAND_START_RE)
  if (startMatch) return parseBudgetMatch(startMatch[1]!, startMatch[2]!)
  const endMatch = text.match(SHORTHAND_END_RE)
  if (endMatch) return parseBudgetMatch(endMatch[1]!, endMatch[2]!)
  const verboseMatch = text.match(VERBOSE_RE)
  if (verboseMatch) return parseBudgetMatch(verboseMatch[1]!, verboseMatch[2]!)
  return null
}

export function findTokenBudgetPositions(
  text: string,
): Array<{ start: number; end: number }> {
  const positions: Array<{ start: number; end: number }> = []
  const startMatch = text.match(SHORTHAND_START_RE)
  if (startMatch) {
    const offset =
      startMatch.index! +
      startMatch[0].length -
      startMatch[0].trimStart().length
    positions.push({
      start: offset,
      end: startMatch.index! + startMatch[0].length,
    })
  }
  const endMatch = text.match(SHORTHAND_END_RE)
  if (endMatch) {
    // Avoid double-counting when input is just "+500k"
    const endStart = endMatch.index! + 1 // +1: regex includes leading \s
    const alreadyCovered = positions.some(
      p => endStart >= p.start && endStart < p.end,
    )
    if (!alreadyCovered) {
      positions.push({
        start: endStart,
        end: endMatch.index! + endMatch[0].length,
      })
    }
  }
  for (const match of text.matchAll(VERBOSE_RE_G)) {
    positions.push({ start: match.index, end: match.index + match[0].length })
  }
  return positions
}

export function getBudgetContinuationMessage(
  pct: number,
  turnTokens: number,
  budget: number,
): string {
  const fmt = (n: number): string => new Intl.NumberFormat('en-US').format(n)
  return `Stopped at ${pct}% of token target (${fmt(turnTokens)} / ${fmt(budget)}). Keep working \u2014 do not summarize.`
}
