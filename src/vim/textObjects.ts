/**
 * Vim Text Object Finding
 *
 * Functions for finding text object boundaries (iw, aw, i", a(, etc.)
 */

import {
  isVimPunctuation,
  isVimWhitespace,
  isVimWordChar,
} from '../utils/Cursor.js'
import { getGraphemeSegmenter } from '../utils/intl.js'

export type TextObjectRange = { start: number; end: number } | null

/**
 * Delimiter pairs for text objects.
 */
const PAIRS: Record<string, [string, string]> = {
  '(': ['(', ')'],
  ')': ['(', ')'],
  b: ['(', ')'],
  '[': ['[', ']'],
  ']': ['[', ']'],
  '{': ['{', '}'],
  '}': ['{', '}'],
  B: ['{', '}'],
  '<': ['<', '>'],
  '>': ['<', '>'],
  '"': ['"', '"'],
  "'": ["'", "'"],
  '`': ['`', '`'],
}

/**
 * Find a text object at the given position.
 */
export function findTextObject(
  text: string,
  offset: number,
  objectType: string,
  isInner: boolean,
): TextObjectRange {
  if (objectType === 'w')
    return findWordObject(text, offset, isInner, isVimWordChar)
  if (objectType === 'W')
    return findWordObject(text, offset, isInner, ch => !isVimWhitespace(ch))

  const pair = PAIRS[objectType]
  if (pair) {
    const [open, close] = pair
    return open === close
      ? findQuoteObject(text, offset, open, isInner)
      : findBracketObject(text, offset, open, close, isInner)
  }

  return null
}

function findWordObject(
  text: string,
  offset: number,
  isInner: boolean,
  isWordChar: (ch: string) => boolean,
): TextObjectRange {
  // Pre-segment into graphemes for grapheme-safe iteration
  const graphemes: Array<{ segment: string; index: number }> = []
  for (const { segment, index } of getGraphemeSegmenter().segment(text)) {
    graphemes.push({ segment, index })
  }

  // Find which grapheme index the offset falls in
  let graphemeIdx = graphemes.length - 1
  for (let i = 0; i < graphemes.length; i++) {
    const g = graphemes[i]!
    const nextStart =
      i + 1 < graphemes.length ? graphemes[i + 1]!.index : text.length
    if (offset >= g.index && offset < nextStart) {
      graphemeIdx = i
      break
    }
  }

  const graphemeAt = (idx: number): string => graphemes[idx]?.segment ?? ''
  const offsetAt = (idx: number): number =>
    idx < graphemes.length ? graphemes[idx]!.index : text.length
  const isWs = (idx: number): boolean => isVimWhitespace(graphemeAt(idx))
  const isWord = (idx: number): boolean => isWordChar(graphemeAt(idx))
  const isPunct = (idx: number): boolean => isVimPunctuation(graphemeAt(idx))

  let startIdx = graphemeIdx
  let endIdx = graphemeIdx

  if (isWord(graphemeIdx)) {
    while (startIdx > 0 && isWord(startIdx - 1)) startIdx--
    while (endIdx < graphemes.length && isWord(endIdx)) endIdx++
  } else if (isWs(graphemeIdx)) {
    while (startIdx > 0 && isWs(startIdx - 1)) startIdx--
    while (endIdx < graphemes.length && isWs(endIdx)) endIdx++
    return { start: offsetAt(startIdx), end: offsetAt(endIdx) }
  } else if (isPunct(graphemeIdx)) {
    while (startIdx > 0 && isPunct(startIdx - 1)) startIdx--
    while (endIdx < graphemes.length && isPunct(endIdx)) endIdx++
  }

  if (!isInner) {
    // Include surrounding whitespace
    if (endIdx < graphemes.length && isWs(endIdx)) {
      while (endIdx < graphemes.length && isWs(endIdx)) endIdx++
    } else if (startIdx > 0 && isWs(startIdx - 1)) {
      while (startIdx > 0 && isWs(startIdx - 1)) startIdx--
    }
  }

  return { start: offsetAt(startIdx), end: offsetAt(endIdx) }
}

function findQuoteObject(
  text: string,
  offset: number,
  quote: string,
  isInner: boolean,
): TextObjectRange {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1
  const lineEnd = text.indexOf('\n', offset)
  const effectiveEnd = lineEnd === -1 ? text.length : lineEnd
  const line = text.slice(lineStart, effectiveEnd)
  const posInLine = offset - lineStart

  const positions: number[] = []
  for (let i = 0; i < line.length; i++) {
    if (line[i] === quote) positions.push(i)
  }

  // Pair quotes correctly: 0-1, 2-3, 4-5, etc.
  for (let i = 0; i < positions.length - 1; i += 2) {
    const qs = positions[i]!
    const qe = positions[i + 1]!
    if (qs <= posInLine && posInLine <= qe) {
      return isInner
        ? { start: lineStart + qs + 1, end: lineStart + qe }
        : { start: lineStart + qs, end: lineStart + qe + 1 }
    }
  }

  return null
}

function findBracketObject(
  text: string,
  offset: number,
  open: string,
  close: string,
  isInner: boolean,
): TextObjectRange {
  let depth = 0
  let start = -1

  for (let i = offset; i >= 0; i--) {
    if (text[i] === close && i !== offset) depth++
    else if (text[i] === open) {
      if (depth === 0) {
        start = i
        break
      }
      depth--
    }
  }
  if (start === -1) return null

  depth = 0
  let end = -1
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === open) depth++
    else if (text[i] === close) {
      if (depth === 0) {
        end = i
        break
      }
      depth--
    }
  }
  if (end === -1) return null

  return isInner ? { start: start + 1, end } : { start, end: end + 1 }
}
