import { stringWidth } from '../ink/stringWidth.js'
import { wrapAnsi } from '../ink/wrapAnsi.js'
import {
  firstGrapheme,
  getGraphemeSegmenter,
  getWordSegmenter,
} from './intl.js'

/**
 * Kill ring for storing killed (cut) text that can be yanked (pasted) with Ctrl+Y.
 * This is global state that shares one kill ring across all input fields.
 *
 * Consecutive kills accumulate in the kill ring until the user types some
 * other key. Alt+Y cycles through previous kills after a yank.
 */
const KILL_RING_MAX_SIZE = 10
let killRing: string[] = []
let killRingIndex = 0
let lastActionWasKill = false

// Track yank state for yank-pop (alt-y)
let lastYankStart = 0
let lastYankLength = 0
let lastActionWasYank = false

export function pushToKillRing(
  text: string,
  direction: 'prepend' | 'append' = 'append',
): void {
  if (text.length > 0) {
    if (lastActionWasKill && killRing.length > 0) {
      // Accumulate with the most recent kill
      if (direction === 'prepend') {
        killRing[0] = text + killRing[0]
      } else {
        killRing[0] = killRing[0] + text
      }
    } else {
      // Add new entry to front of ring
      killRing.unshift(text)
      if (killRing.length > KILL_RING_MAX_SIZE) {
        killRing.pop()
      }
    }
    lastActionWasKill = true
    // Reset yank state when killing new text
    lastActionWasYank = false
  }
}

export function getLastKill(): string {
  return killRing[0] ?? ''
}

export function getKillRingItem(index: number): string {
  if (killRing.length === 0) return ''
  const normalizedIndex =
    ((index % killRing.length) + killRing.length) % killRing.length
  return killRing[normalizedIndex] ?? ''
}

export function getKillRingSize(): number {
  return killRing.length
}

export function clearKillRing(): void {
  killRing = []
  killRingIndex = 0
  lastActionWasKill = false
  lastActionWasYank = false
  lastYankStart = 0
  lastYankLength = 0
}

export function resetKillAccumulation(): void {
  lastActionWasKill = false
}

// Yank tracking for yank-pop
export function recordYank(start: number, length: number): void {
  lastYankStart = start
  lastYankLength = length
  lastActionWasYank = true
  killRingIndex = 0
}

export function canYankPop(): boolean {
  return lastActionWasYank && killRing.length > 1
}

export function yankPop(): {
  text: string
  start: number
  length: number
} | null {
  if (!lastActionWasYank || killRing.length <= 1) {
    return null
  }
  // Cycle to next item in kill ring
  killRingIndex = (killRingIndex + 1) % killRing.length
  const text = killRing[killRingIndex] ?? ''
  return { text, start: lastYankStart, length: lastYankLength }
}

export function updateYankLength(length: number): void {
  lastYankLength = length
}

export function resetYankState(): void {
  lastActionWasYank = false
}

/**
 * Text Processing Flow for Unicode Normalization:
 *
 * User Input (raw text, potentially mixed NFD/NFC)
 *     ↓
 * MeasuredText (normalizes to NFC + builds grapheme info)
 *     ↓
 * All cursor operations use normalized text/offsets
 *     ↓
 * Display uses normalized text from wrappedLines
 *
 * This flow ensures consistent Unicode handling:
 * - NFD/NFC normalization differences don't break cursor movement
 * - Grapheme clusters (like 👨‍👩‍👧‍👦) are treated as single units
 * - Display width calculations are accurate for CJK characters
 *
 * RULE: Once text enters MeasuredText, all operations
 * work on the normalized version.
 */

// Pre-compiled regex patterns for Vim word detection (avoid creating in hot loops)
export const VIM_WORD_CHAR_REGEX = /^[\p{L}\p{N}\p{M}_]$/u
export const WHITESPACE_REGEX = /\s/

// Exported helper functions for Vim character classification
export const isVimWordChar = (ch: string): boolean =>
  VIM_WORD_CHAR_REGEX.test(ch)
export const isVimWhitespace = (ch: string): boolean =>
  WHITESPACE_REGEX.test(ch)
export const isVimPunctuation = (ch: string): boolean =>
  ch.length > 0 && !isVimWhitespace(ch) && !isVimWordChar(ch)

type WrappedText = string[]
type Position = {
  line: number
  column: number
}

export class Cursor {
  readonly offset: number
  constructor(
    readonly measuredText: MeasuredText,
    offset: number = 0,
    readonly selection: number = 0,
  ) {
    // it's ok for the cursor to be 1 char beyond the end of the string
    this.offset = Math.max(0, Math.min(this.text.length, offset))
  }

  static fromText(
    text: string,
    columns: number,
    offset: number = 0,
    selection: number = 0,
  ): Cursor {
    // make MeasuredText on less than columns width, to account for cursor
    return new Cursor(new MeasuredText(text, columns - 1), offset, selection)
  }

  getViewportStartLine(maxVisibleLines?: number): number {
    if (maxVisibleLines === undefined || maxVisibleLines <= 0) return 0
    const { line } = this.getPosition()
    const allLines = this.measuredText.getWrappedText()
    if (allLines.length <= maxVisibleLines) return 0
    const half = Math.floor(maxVisibleLines / 2)
    let startLine = Math.max(0, line - half)
    const endLine = Math.min(allLines.length, startLine + maxVisibleLines)
    if (endLine - startLine < maxVisibleLines) {
      startLine = Math.max(0, endLine - maxVisibleLines)
    }
    return startLine
  }

  getViewportCharOffset(maxVisibleLines?: number): number {
    const startLine = this.getViewportStartLine(maxVisibleLines)
    if (startLine === 0) return 0
    const wrappedLines = this.measuredText.getWrappedLines()
    return wrappedLines[startLine]?.startOffset ?? 0
  }

  getViewportCharEnd(maxVisibleLines?: number): number {
    const startLine = this.getViewportStartLine(maxVisibleLines)
    const allLines = this.measuredText.getWrappedLines()
    if (maxVisibleLines === undefined || maxVisibleLines <= 0)
      return this.text.length
    const endLine = Math.min(allLines.length, startLine + maxVisibleLines)
    if (endLine >= allLines.length) return this.text.length
    return allLines[endLine]?.startOffset ?? this.text.length
  }

  render(
    cursorChar: string,
    mask: string,
    invert: (text: string) => string,
    ghostText?: { text: string; dim: (text: string) => string },
    maxVisibleLines?: number,
  ) {
    const { line, column } = this.getPosition()
    const allLines = this.measuredText.getWrappedText()

    const startLine = this.getViewportStartLine(maxVisibleLines)
    const endLine =
      maxVisibleLines !== undefined && maxVisibleLines > 0
        ? Math.min(allLines.length, startLine + maxVisibleLines)
        : allLines.length

    return allLines
      .slice(startLine, endLine)
      .map((text, i) => {
        const currentLine = i + startLine
        let displayText = text
        if (mask) {
          const graphemes = Array.from(getGraphemeSegmenter().segment(text))
          if (currentLine === allLines.length - 1) {
            // Last line: mask all but the trailing 6 chars so the user can
            // confirm they pasted the right thing without exposing the full token
            const visibleCount = Math.min(6, graphemes.length)
            const maskCount = graphemes.length - visibleCount
            const splitOffset =
              graphemes.length > visibleCount ? graphemes[maskCount]!.index : 0
            displayText = mask.repeat(maskCount) + text.slice(splitOffset)
          } else {
            // Earlier wrapped lines: fully mask. Previously only the last line
            // was masked, leaking the start of the token on narrow terminals
            // where the pasted OAuth code wraps across multiple lines.
            displayText = mask.repeat(graphemes.length)
          }
        }
        // looking for the line with the cursor
        if (line !== currentLine) return displayText.trimEnd()

        // Split the line into before/at/after cursor in a single pass over the
        // graphemes, accumulating display width until we reach the cursor column.
        // This replaces a two-pass approach (displayWidthToStringIndex + a second
        // segmenter pass) — the intermediate stringIndex from that approach is
        // always a grapheme boundary, so the "cursor in the middle of a
        // multi-codepoint character" branch was unreachable.
        let beforeCursor = ''
        let atCursor = cursorChar
        let afterCursor = ''
        let currentWidth = 0
        let cursorFound = false

        for (const { segment } of getGraphemeSegmenter().segment(displayText)) {
          if (cursorFound) {
            afterCursor += segment
            continue
          }
          const nextWidth = currentWidth + stringWidth(segment)
          if (nextWidth > column) {
            atCursor = segment
            cursorFound = true
          } else {
            currentWidth = nextWidth
            beforeCursor += segment
          }
        }

        // Only invert the cursor if we have a cursor character to show
        // When ghost text is present and cursor is at end, show first ghost char in cursor
        let renderedCursor: string
        let ghostSuffix = ''
        if (
          ghostText &&
          currentLine === allLines.length - 1 &&
          this.isAtEnd() &&
          ghostText.text.length > 0
        ) {
          // First ghost character goes in the inverted cursor (grapheme-safe)
          const firstGhostChar =
            firstGrapheme(ghostText.text) || ghostText.text[0]!
          renderedCursor = cursorChar ? invert(firstGhostChar) : firstGhostChar
          // Rest of ghost text is dimmed after cursor
          const ghostRest = ghostText.text.slice(firstGhostChar.length)
          if (ghostRest.length > 0) {
            ghostSuffix = ghostText.dim(ghostRest)
          }
        } else {
          renderedCursor = cursorChar ? invert(atCursor) : atCursor
        }

        return (
          beforeCursor + renderedCursor + ghostSuffix + afterCursor.trimEnd()
        )
      })
      .join('\n')
  }

  left(): Cursor {
    if (this.offset === 0) return this

    const chip = this.imageRefEndingAt(this.offset)
    if (chip) return new Cursor(this.measuredText, chip.start)

    const prevOffset = this.measuredText.prevOffset(this.offset)
    return new Cursor(this.measuredText, prevOffset)
  }

  right(): Cursor {
    if (this.offset >= this.text.length) return this

    const chip = this.imageRefStartingAt(this.offset)
    if (chip) return new Cursor(this.measuredText, chip.end)

    const nextOffset = this.measuredText.nextOffset(this.offset)
    return new Cursor(this.measuredText, Math.min(nextOffset, this.text.length))
  }

  /**
   * If an [Image #N] chip ends at `offset`, return its bounds. Used by left()
   * to hop the cursor over the chip instead of stepping into it.
   */
  imageRefEndingAt(offset: number): { start: number; end: number } | null {
    const m = this.text.slice(0, offset).match(/\[Image #\d+\]$/)
    return m ? { start: offset - m[0].length, end: offset } : null
  }

  imageRefStartingAt(offset: number): { start: number; end: number } | null {
    const m = this.text.slice(offset).match(/^\[Image #\d+\]/)
    return m ? { start: offset, end: offset + m[0].length } : null
  }

  /**
   * If offset lands strictly inside an [Image #N] chip, snap it to the given
   * boundary. Used by word-movement methods so Ctrl+W / Alt+D never leave a
   * partial chip.
   */
  snapOutOfImageRef(offset: number, toward: 'start' | 'end'): number {
    const re = /\[Image #\d+\]/g
    let m
    while ((m = re.exec(this.text)) !== null) {
      const start = m.index
      const end = start + m[0].length
      if (offset > start && offset < end) {
        return toward === 'start' ? start : end
      }
    }
    return offset
  }

  up(): Cursor {
    const { line, column } = this.getPosition()
    if (line === 0) {
      return this
    }

    const prevLine = this.measuredText.getWrappedText()[line - 1]
    if (prevLine === undefined) {
      return this
    }

    const prevLineDisplayWidth = stringWidth(prevLine)
    if (column > prevLineDisplayWidth) {
      const newOffset = this.getOffset({
        line: line - 1,
        column: prevLineDisplayWidth,
      })
      return new Cursor(this.measuredText, newOffset, 0)
    }

    const newOffset = this.getOffset({ line: line - 1, column })
    return new Cursor(this.measuredText, newOffset, 0)
  }

  down(): Cursor {
    const { line, column } = this.getPosition()
    if (line >= this.measuredText.lineCount - 1) {
      return this
    }

    // If there is no next line, stay on the current line,
    // and let the caller handle it (e.g. for prompt input,
    // we move to the next history entry)
    const nextLine = this.measuredText.getWrappedText()[line + 1]
    if (nextLine === undefined) {
      return this
    }

    // If the current column is past the end of the next line,
    // move to the end of the next line
    const nextLineDisplayWidth = stringWidth(nextLine)
    if (column > nextLineDisplayWidth) {
      const newOffset = this.getOffset({
        line: line + 1,
        column: nextLineDisplayWidth,
      })
      return new Cursor(this.measuredText, newOffset, 0)
    }

    // Otherwise, move to the same column on the next line
    const newOffset = this.getOffset({
      line: line + 1,
      column,
    })
    return new Cursor(this.measuredText, newOffset, 0)
  }

  /**
   * Move to the start of the current line (column 0).
   * This is the raw version used internally by startOfLine.
   */
  private startOfCurrentLine(): Cursor {
    const { line } = this.getPosition()
    return new Cursor(
      this.measuredText,
      this.getOffset({
        line,
        column: 0,
      }),
      0,
    )
  }

  startOfLine(): Cursor {
    const { line, column } = this.getPosition()

    // If already at start of line and not at first line, move to previous line
    if (column === 0 && line > 0) {
      return new Cursor(
        this.measuredText,
        this.getOffset({
          line: line - 1,
          column: 0,
        }),
        0,
      )
    }

    return this.startOfCurrentLine()
  }

  firstNonBlankInLine(): Cursor {
    const { line } = this.getPosition()
    const lineText = this.measuredText.getWrappedText()[line] || ''

    const match = lineText.match(/^\s*\S/)
    const column = match?.index ? match.index + match[0].length - 1 : 0
    const offset = this.getOffset({ line, column })

    return new Cursor(this.measuredText, offset, 0)
  }

  endOfLine(): Cursor {
    const { line } = this.getPosition()
    const column = this.measuredText.getLineLength(line)
    const offset = this.getOffset({ line, column })
    return new Cursor(this.measuredText, offset, 0)
  }

  // Helper methods for finding logical line boundaries
  private findLogicalLineStart(fromOffset: number = this.offset): number {
    const prevNewline = this.text.lastIndexOf('\n', fromOffset - 1)
    return prevNewline === -1 ? 0 : prevNewline + 1
  }

  private findLogicalLineEnd(fromOffset: number = this.offset): number {
    const nextNewline = this.text.indexOf('\n', fromOffset)
    return nextNewline === -1 ? this.text.length : nextNewline
  }

  // Helper to get logical line bounds for current position
  private getLogicalLineBounds(): { start: number; end: number } {
    return {
      start: this.findLogicalLineStart(),
      end: this.findLogicalLineEnd(),
    }
  }

  // Helper to create cursor with preserved column, clamped to line length
  // Snaps to grapheme boundary to avoid landing mid-grapheme
  private createCursorWithColumn(
    lineStart: number,
    lineEnd: number,
    targetColumn: number,
  ): Cursor {
    const lineLength = lineEnd - lineStart
    const clampedColumn = Math.min(targetColumn, lineLength)
    const rawOffset = lineStart + clampedColumn
    const offset = this.measuredText.snapToGraphemeBoundary(rawOffset)
    return new Cursor(this.measuredText, offset, 0)
  }

  endOfLogicalLine(): Cursor {
    return new Cursor(this.measuredText, this.findLogicalLineEnd(), 0)
  }

  startOfLogicalLine(): Cursor {
    return new Cursor(this.measuredText, this.findLogicalLineStart(), 0)
  }

  firstNonBlankInLogicalLine(): Cursor {
    const { start, end } = this.getLogicalLineBounds()
    const lineText = this.text.slice(start, end)
    const match = lineText.match(/\S/)
    const offset = start + (match?.index ?? 0)
    return new Cursor(this.measuredText, offset, 0)
  }

  upLogicalLine(): Cursor {
    const { start: currentStart } = this.getLogicalLineBounds()

    // At first line - stay at beginning
    if (currentStart === 0) {
      return new Cursor(this.measuredText, 0, 0)
    }

    // Calculate target column position
    const currentColumn = this.offset - currentStart

    // Find previous line bounds
    const prevLineEnd = currentStart - 1
    const prevLineStart = this.findLogicalLineStart(prevLineEnd)

    return this.createCursorWithColumn(
      prevLineStart,
      prevLineEnd,
      currentColumn,
    )
  }

  downLogicalLine(): Cursor {
    const { start: currentStart, end: currentEnd } = this.getLogicalLineBounds()

    // At last line - stay at end
    if (currentEnd >= this.text.length) {
      return new Cursor(this.measuredText, this.text.length, 0)
    }

    // Calculate target column position
    const currentColumn = this.offset - currentStart

    // Find next line bounds
    const nextLineStart = currentEnd + 1
    const nextLineEnd = this.findLogicalLineEnd(nextLineStart)

    return this.createCursorWithColumn(
      nextLineStart,
      nextLineEnd,
      currentColumn,
    )
  }

  // Vim word vs WORD movements:
  // - word (lowercase w/b/e): sequences of letters, digits, and underscores
  // - WORD (uppercase W/B/E): sequences of non-whitespace characters
  // For example, in "hello-world!", word movements see 3 words: "hello", "world", and nothing
  // But WORD movements see 1 WORD: "hello-world!"

  nextWord(): Cursor {
    if (this.isAtEnd()) {
      return this
    }

    // Use Intl.Segmenter for proper word boundary detection (including CJK)
    const wordBoundaries = this.measuredText.getWordBoundaries()

    // Find the next word start boundary after current position
    for (const boundary of wordBoundaries) {
      if (boundary.isWordLike && boundary.start > this.offset) {
        return new Cursor(this.measuredText, boundary.start)
      }
    }

    // If no next word found, go to end
    return new Cursor(this.measuredText, this.text.length)
  }

  endOfWord(): Cursor {
    if (this.isAtEnd()) {
      return this
    }

    // Use Intl.Segmenter for proper word boundary detection (including CJK)
    const wordBoundaries = this.measuredText.getWordBoundaries()

    // Find the current word boundary we're in
    for (const boundary of wordBoundaries) {
      if (!boundary.isWordLike) continue

      // If we're inside this word but NOT at the last character
      if (this.offset >= boundary.start && this.offset < boundary.end - 1) {
        // Move to end of this word (last character position)
        return new Cursor(this.measuredText, boundary.end - 1)
      }

      // If we're at the last character of a word (end - 1), find the next word's end
      if (this.offset === boundary.end - 1) {
        // Find next word
        for (const nextBoundary of wordBoundaries) {
          if (nextBoundary.isWordLike && nextBoundary.start > this.offset) {
            return new Cursor(this.measuredText, nextBoundary.end - 1)
          }
        }
        return this
      }
    }

    // If not in a word, find the next word and go to its end
    for (const boundary of wordBoundaries) {
      if (boundary.isWordLike && boundary.start > this.offset) {
        return new Cursor(this.measuredText, boundary.end - 1)
      }
    }

    return this
  }

  prevWord(): Cursor {
    if (this.isAtStart()) {
      return this
    }

    // Use Intl.Segmenter for proper word boundary detection (including CJK)
    const wordBoundaries = this.measuredText.getWordBoundaries()

    // Find the previous word start boundary before current position
    // We need to iterate in reverse to find the previous word
    let prevWordStart: number | null = null

    for (const boundary of wordBoundaries) {
      if (!boundary.isWordLike) continue

      // If we're at or after the start of this word, but this word starts before us
      if (boundary.start < this.offset) {
        // If we're inside this word (not at the start), go to its start
        if (this.offset > boundary.start && this.offset <= boundary.end) {
          return new Cursor(this.measuredText, boundary.start)
        }
        // Otherwise, remember this as a candidate for previous word
        prevWordStart = boundary.start
      }
    }

    if (prevWordStart !== null) {
      return new Cursor(this.measuredText, prevWordStart)
    }

    return new Cursor(this.measuredText, 0)
  }

  // Vim-specific word methods
  // In Vim, a "word" is either:
  // 1. A sequence of word characters (letters, digits, underscore) - including Unicode
  // 2. A sequence of non-blank, non-word characters (punctuation/symbols)

  nextVimWord(): Cursor {
    if (this.isAtEnd()) {
      return this
    }

    let pos = this.offset
    const advance = (p: number): number => this.measuredText.nextOffset(p)

    const currentGrapheme = this.graphemeAt(pos)
    if (!currentGrapheme) {
      return this
    }

    if (isVimWordChar(currentGrapheme)) {
      while (pos < this.text.length && isVimWordChar(this.graphemeAt(pos))) {
        pos = advance(pos)
      }
    } else if (isVimPunctuation(currentGrapheme)) {
      while (pos < this.text.length && isVimPunctuation(this.graphemeAt(pos))) {
        pos = advance(pos)
      }
    }

    while (
      pos < this.text.length &&
      WHITESPACE_REGEX.test(this.graphemeAt(pos))
    ) {
      pos = advance(pos)
    }

    return new Cursor(this.measuredText, pos)
  }

  endOfVimWord(): Cursor {
    if (this.isAtEnd()) {
      return this
    }

    const text = this.text
    let pos = this.offset
    const advance = (p: number): number => this.measuredText.nextOffset(p)

    if (this.graphemeAt(pos) === '') {
      return this
    }

    pos = advance(pos)

    while (pos < text.length && WHITESPACE_REGEX.test(this.graphemeAt(pos))) {
      pos = advance(pos)
    }

    if (pos >= text.length) {
      return new Cursor(this.measuredText, text.length)
    }

    const charAtPos = this.graphemeAt(pos)
    if (isVimWordChar(charAtPos)) {
      while (pos < text.length) {
        const nextPos = advance(pos)
        if (nextPos >= text.length || !isVimWordChar(this.graphemeAt(nextPos)))
          break
        pos = nextPos
      }
    } else if (isVimPunctuation(charAtPos)) {
      while (pos < text.length) {
        const nextPos = advance(pos)
        if (
          nextPos >= text.length ||
          !isVimPunctuation(this.graphemeAt(nextPos))
        )
          break
        pos = nextPos
      }
    }

    return new Cursor(this.measuredText, pos)
  }

  prevVimWord(): Cursor {
    if (this.isAtStart()) {
      return this
    }

    let pos = this.offset
    const retreat = (p: number): number => this.measuredText.prevOffset(p)

    pos = retreat(pos)

    while (pos > 0 && WHITESPACE_REGEX.test(this.graphemeAt(pos))) {
      pos = retreat(pos)
    }

    // At position 0 with whitespace means no previous word exists, go to start
    if (pos === 0 && WHITESPACE_REGEX.test(this.graphemeAt(0))) {
      return new Cursor(this.measuredText, 0)
    }

    const charAtPos = this.graphemeAt(pos)
    if (isVimWordChar(charAtPos)) {
      while (pos > 0) {
        const prevPos = retreat(pos)
        if (!isVimWordChar(this.graphemeAt(prevPos))) break
        pos = prevPos
      }
    } else if (isVimPunctuation(charAtPos)) {
      while (pos > 0) {
        const prevPos = retreat(pos)
        if (!isVimPunctuation(this.graphemeAt(prevPos))) break
        pos = prevPos
      }
    }

    return new Cursor(this.measuredText, pos)
  }

  nextWORD(): Cursor {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let nextCursor: Cursor = this
    // If we're on a non-whitespace character, move to the next whitespace
    while (!nextCursor.isOverWhitespace() && !nextCursor.isAtEnd()) {
      nextCursor = nextCursor.right()
    }
    // now move to the next non-whitespace character
    while (nextCursor.isOverWhitespace() && !nextCursor.isAtEnd()) {
      nextCursor = nextCursor.right()
    }
    return nextCursor
  }

  endOfWORD(): Cursor {
    if (this.isAtEnd()) {
      return this
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let cursor: Cursor = this

    // Check if we're already at the end of a WORD
    // (current character is non-whitespace, but next character is whitespace or we're at the end)
    const atEndOfWORD =
      !cursor.isOverWhitespace() &&
      (cursor.right().isOverWhitespace() || cursor.right().isAtEnd())

    if (atEndOfWORD) {
      // We're already at the end of a WORD, move to the next WORD
      cursor = cursor.right()
      return cursor.endOfWORD()
    }

    // If we're on a whitespace character, find the next WORD
    if (cursor.isOverWhitespace()) {
      cursor = cursor.nextWORD()
    }

    // Now move to the end of the current WORD
    while (!cursor.right().isOverWhitespace() && !cursor.isAtEnd()) {
      cursor = cursor.right()
    }

    return cursor
  }

  prevWORD(): Cursor {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let cursor: Cursor = this

    // if we are already at the beginning of a WORD, step off it
    if (cursor.left().isOverWhitespace()) {
      cursor = cursor.left()
    }

    // Move left over any whitespace characters
    while (cursor.isOverWhitespace() && !cursor.isAtStart()) {
      cursor = cursor.left()
    }

    // If we're over a non-whitespace character, move to the start of this WORD
    if (!cursor.isOverWhitespace()) {
      while (!cursor.left().isOverWhitespace() && !cursor.isAtStart()) {
        cursor = cursor.left()
      }
    }

    return cursor
  }

  modifyText(end: Cursor, insertString: string = ''): Cursor {
    const startOffset = this.offset
    const endOffset = end.offset

    const newText =
      this.text.slice(0, startOffset) +
      insertString +
      this.text.slice(endOffset)

    return Cursor.fromText(
      newText,
      this.columns,
      startOffset + insertString.normalize('NFC').length,
    )
  }

  insert(insertString: string): Cursor {
    const newCursor = this.modifyText(this, insertString)
    return newCursor
  }

  del(): Cursor {
    if (this.isAtEnd()) {
      return this
    }
    return this.modifyText(this.right())
  }

  backspace(): Cursor {
    if (this.isAtStart()) {
      return this
    }
    return this.left().modifyText(this)
  }

  deleteToLineStart(): { cursor: Cursor; killed: string } {
    // If cursor is right after a newline (at start of line), delete just that
    // newline — symmetric with deleteToLineEnd's newline handling. This lets
    // repeated ctrl+u clear across lines.
    if (this.offset > 0 && this.text[this.offset - 1] === '\n') {
      return { cursor: this.left().modifyText(this), killed: '\n' }
    }

    // Use startOfLine() so that at column 0 of a wrapped visual line,
    // the cursor moves to the previous visual line's start instead of
    // getting stuck.
    const startCursor = this.startOfLine()
    const killed = this.text.slice(startCursor.offset, this.offset)
    return { cursor: startCursor.modifyText(this), killed }
  }

  deleteToLineEnd(): { cursor: Cursor; killed: string } {
    // If cursor is on a newline character, delete just that character
    if (this.text[this.offset] === '\n') {
      return { cursor: this.modifyText(this.right()), killed: '\n' }
    }

    const endCursor = this.endOfLine()
    const killed = this.text.slice(this.offset, endCursor.offset)
    return { cursor: this.modifyText(endCursor), killed }
  }

  deleteToLogicalLineEnd(): Cursor {
    // If cursor is on a newline character, delete just that character
    if (this.text[this.offset] === '\n') {
      return this.modifyText(this.right())
    }

    return this.modifyText(this.endOfLogicalLine())
  }

  deleteWordBefore(): { cursor: Cursor; killed: string } {
    if (this.isAtStart()) {
      return { cursor: this, killed: '' }
    }
    const target = this.snapOutOfImageRef(this.prevWord().offset, 'start')
    const prevWordCursor = new Cursor(this.measuredText, target)
    const killed = this.text.slice(prevWordCursor.offset, this.offset)
    return { cursor: prevWordCursor.modifyText(this), killed }
  }

  /**
   * Deletes a token before the cursor if one exists.
   * Supports pasted text refs: [Pasted text #1], [Pasted text #1 +10 lines],
   * [...Truncated text #1 +10 lines...]
   *
   * Note: @mentions are NOT tokenized since users may want to correct typos
   * in file paths. Use Ctrl/Cmd+backspace for word-deletion on mentions.
   *
   * Returns null if no token found at cursor position.
   * Only triggers when cursor is at end of token (followed by whitespace or EOL).
   */
  deleteTokenBefore(): Cursor | null {
    // Cursor at chip.start is the "selected" state — backspace deletes the
    // chip forward, not the char before it.
    const chipAfter = this.imageRefStartingAt(this.offset)
    if (chipAfter) {
      const end =
        this.text[chipAfter.end] === ' ' ? chipAfter.end + 1 : chipAfter.end
      return this.modifyText(new Cursor(this.measuredText, end))
    }

    if (this.isAtStart()) {
      return null
    }

    // Only trigger if cursor is at a word boundary (whitespace or end of string after cursor)
    const charAfter = this.text[this.offset]
    if (charAfter !== undefined && !/\s/.test(charAfter)) {
      return null
    }

    const textBefore = this.text.slice(0, this.offset)

    // Check for pasted/truncated text refs: [Pasted text #1] or [...Truncated text #1 +50 lines...]
    const pasteMatch = textBefore.match(
      /(^|\s)\[(Pasted text #\d+(?: \+\d+ lines)?|Image #\d+|\.\.\.Truncated text #\d+ \+\d+ lines\.\.\.)\]$/,
    )
    if (pasteMatch) {
      const matchStart = pasteMatch.index! + pasteMatch[1]!.length
      return new Cursor(this.measuredText, matchStart).modifyText(this)
    }

    return null
  }

  deleteWordAfter(): Cursor {
    if (this.isAtEnd()) {
      return this
    }

    const target = this.snapOutOfImageRef(this.nextWord().offset, 'end')
    return this.modifyText(new Cursor(this.measuredText, target))
  }

  private graphemeAt(pos: number): string {
    if (pos >= this.text.length) return ''
    const nextOff = this.measuredText.nextOffset(pos)
    return this.text.slice(pos, nextOff)
  }

  private isOverWhitespace(): boolean {
    const currentChar = this.text[this.offset] ?? ''
    return /\s/.test(currentChar)
  }

  equals(other: Cursor): boolean {
    return (
      this.offset === other.offset && this.measuredText === other.measuredText
    )
  }

  isAtStart(): boolean {
    return this.offset === 0
  }
  isAtEnd(): boolean {
    return this.offset >= this.text.length
  }

  startOfFirstLine(): Cursor {
    // Go to the very beginning of the text (first character of first line)
    return new Cursor(this.measuredText, 0, 0)
  }

  startOfLastLine(): Cursor {
    // Go to the beginning of the last line
    const lastNewlineIndex = this.text.lastIndexOf('\n')

    if (lastNewlineIndex === -1) {
      // If there are no newlines, the text is a single line
      return this.startOfLine()
    }

    // Position after the last newline character
    return new Cursor(this.measuredText, lastNewlineIndex + 1, 0)
  }

  goToLine(lineNumber: number): Cursor {
    // Go to the beginning of the specified logical line (1-indexed, like vim)
    // Uses logical lines (separated by \n), not wrapped display lines
    const lines = this.text.split('\n')
    const targetLine = Math.min(Math.max(0, lineNumber - 1), lines.length - 1)
    let offset = 0
    for (let i = 0; i < targetLine; i++) {
      offset += (lines[i]?.length ?? 0) + 1 // +1 for newline
    }
    return new Cursor(this.measuredText, offset, 0)
  }

  endOfFile(): Cursor {
    return new Cursor(this.measuredText, this.text.length, 0)
  }

  public get text(): string {
    return this.measuredText.text
  }

  private get columns(): number {
    return this.measuredText.columns + 1
  }

  getPosition(): Position {
    return this.measuredText.getPositionFromOffset(this.offset)
  }

  private getOffset(position: Position): number {
    return this.measuredText.getOffsetFromPosition(position)
  }

  /**
   * Find a character using vim f/F/t/T semantics.
   *
   * @param char - The character to find
   * @param type - 'f' (forward to), 'F' (backward to), 't' (forward till), 'T' (backward till)
   * @param count - Find the Nth occurrence
   * @returns The target offset, or null if not found
   */
  findCharacter(
    char: string,
    type: 'f' | 'F' | 't' | 'T',
    count: number = 1,
  ): number | null {
    const text = this.text
    const forward = type === 'f' || type === 't'
    const till = type === 't' || type === 'T'
    let found = 0

    if (forward) {
      let pos = this.measuredText.nextOffset(this.offset)
      while (pos < text.length) {
        const grapheme = this.graphemeAt(pos)
        if (grapheme === char) {
          found++
          if (found === count) {
            return till
              ? Math.max(this.offset, this.measuredText.prevOffset(pos))
              : pos
          }
        }
        pos = this.measuredText.nextOffset(pos)
      }
    } else {
      if (this.offset === 0) return null
      let pos = this.measuredText.prevOffset(this.offset)
      while (pos >= 0) {
        const grapheme = this.graphemeAt(pos)
        if (grapheme === char) {
          found++
          if (found === count) {
            return till
              ? Math.min(this.offset, this.measuredText.nextOffset(pos))
              : pos
          }
        }
        if (pos === 0) break
        pos = this.measuredText.prevOffset(pos)
      }
    }

    return null
  }
}

class WrappedLine {
  constructor(
    public readonly text: string,
    public readonly startOffset: number,
    public readonly isPrecededByNewline: boolean,
    public readonly endsWithNewline: boolean = false,
  ) {}

  equals(other: WrappedLine): boolean {
    return this.text === other.text && this.startOffset === other.startOffset
  }

  get length(): number {
    return this.text.length + (this.endsWithNewline ? 1 : 0)
  }
}

export class MeasuredText {
  private _wrappedLines?: WrappedLine[]
  public readonly text: string
  private navigationCache: Map<string, number>
  private graphemeBoundaries?: number[]

  constructor(
    text: string,
    readonly columns: number,
  ) {
    this.text = text.normalize('NFC')
    this.navigationCache = new Map()
  }

  /**
   * Lazily computes and caches wrapped lines.
   * This expensive operation is deferred until actually needed.
   */
  private get wrappedLines(): WrappedLine[] {
    if (!this._wrappedLines) {
      this._wrappedLines = this.measureWrappedText()
    }
    return this._wrappedLines
  }

  private getGraphemeBoundaries(): number[] {
    if (!this.graphemeBoundaries) {
      this.graphemeBoundaries = []
      for (const { index } of getGraphemeSegmenter().segment(this.text)) {
        this.graphemeBoundaries.push(index)
      }
      // Add the end of text as a boundary
      this.graphemeBoundaries.push(this.text.length)
    }
    return this.graphemeBoundaries
  }

  private wordBoundariesCache?: Array<{
    start: number
    end: number
    isWordLike: boolean
  }>

  /**
   * Get word boundaries using Intl.Segmenter for proper Unicode word segmentation.
   * This correctly handles CJK (Chinese, Japanese, Korean) text where each character
   * is typically its own word, as well as scripts that use spaces between words.
   */
  public getWordBoundaries(): Array<{
    start: number
    end: number
    isWordLike: boolean
  }> {
    if (!this.wordBoundariesCache) {
      this.wordBoundariesCache = []
      for (const segment of getWordSegmenter().segment(this.text)) {
        this.wordBoundariesCache.push({
          start: segment.index,
          end: segment.index + segment.segment.length,
          isWordLike: segment.isWordLike ?? false,
        })
      }
    }
    return this.wordBoundariesCache
  }

  /**
   * Binary search for boundaries.
   * @param boundaries: Sorted array of boundaries
   * @param target: Target offset
   * @param findNext: If true, finds first boundary > target. If false, finds last boundary < target.
   * @returns The found boundary index, or appropriate default
   */
  private binarySearchBoundary(
    boundaries: number[],
    target: number,
    findNext: boolean,
  ): number {
    let left = 0
    let right = boundaries.length - 1
    let result = findNext ? this.text.length : 0

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const boundary = boundaries[mid]
      if (boundary === undefined) break

      if (findNext) {
        if (boundary > target) {
          result = boundary
          right = mid - 1
        } else {
          left = mid + 1
        }
      } else {
        if (boundary < target) {
          result = boundary
          left = mid + 1
        } else {
          right = mid - 1
        }
      }
    }

    return result
  }

  // Convert string index to display width
  public stringIndexToDisplayWidth(text: string, index: number): number {
    if (index <= 0) return 0
    if (index >= text.length) return stringWidth(text)
    return stringWidth(text.substring(0, index))
  }

  // Convert display width to string index
  public displayWidthToStringIndex(text: string, targetWidth: number): number {
    if (targetWidth <= 0) return 0
    if (!text) return 0

    // If the text matches our text, use the precomputed graphemes
    if (text === this.text) {
      return this.offsetAtDisplayWidth(targetWidth)
    }

    // Otherwise compute on the fly
    let currentWidth = 0
    let currentOffset = 0

    for (const { segment, index } of getGraphemeSegmenter().segment(text)) {
      const segmentWidth = stringWidth(segment)

      if (currentWidth + segmentWidth > targetWidth) {
        break
      }

      currentWidth += segmentWidth
      currentOffset = index + segment.length
    }

    return currentOffset
  }

  /**
   * Find the string offset that corresponds to a target display width.
   */
  private offsetAtDisplayWidth(targetWidth: number): number {
    if (targetWidth <= 0) return 0

    let currentWidth = 0
    const boundaries = this.getGraphemeBoundaries()

    // Iterate through grapheme boundaries
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i]
      const end = boundaries[i + 1]
      if (start === undefined || end === undefined) continue
      const segment = this.text.substring(start, end)
      const segmentWidth = stringWidth(segment)

      if (currentWidth + segmentWidth > targetWidth) {
        return start
      }
      currentWidth += segmentWidth
    }

    return this.text.length
  }

  private measureWrappedText(): WrappedLine[] {
    const wrappedText = wrapAnsi(this.text, this.columns, {
      hard: true,
      trim: false,
    })

    const wrappedLines: WrappedLine[] = []
    let searchOffset = 0
    let lastNewLinePos = -1

    const lines = wrappedText.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i]!
      const isPrecededByNewline = (startOffset: number) =>
        i === 0 || (startOffset > 0 && this.text[startOffset - 1] === '\n')

      if (text.length === 0) {
        // For blank lines, find the next newline character after the last one
        lastNewLinePos = this.text.indexOf('\n', lastNewLinePos + 1)

        if (lastNewLinePos !== -1) {
          const startOffset = lastNewLinePos
          const endsWithNewline = true

          wrappedLines.push(
            new WrappedLine(
              text,
              startOffset,
              isPrecededByNewline(startOffset),
              endsWithNewline,
            ),
          )
        } else {
          // If we can't find another newline, this must be the end of text
          const startOffset = this.text.length
          wrappedLines.push(
            new WrappedLine(
              text,
              startOffset,
              isPrecededByNewline(startOffset),
              false,
            ),
          )
        }
      } else {
        // For non-blank lines, find the text in this.text
        const startOffset = this.text.indexOf(text, searchOffset)

        if (startOffset === -1) {
          throw new Error('Failed to find wrapped line in text')
        }

        searchOffset = startOffset + text.length

        // Check if this line ends with a newline in this.text
        const potentialNewlinePos = startOffset + text.length
        const endsWithNewline =
          potentialNewlinePos < this.text.length &&
          this.text[potentialNewlinePos] === '\n'

        if (endsWithNewline) {
          lastNewLinePos = potentialNewlinePos
        }

        wrappedLines.push(
          new WrappedLine(
            text,
            startOffset,
            isPrecededByNewline(startOffset),
            endsWithNewline,
          ),
        )
      }
    }

    return wrappedLines
  }

  public getWrappedText(): WrappedText {
    return this.wrappedLines.map(line =>
      line.isPrecededByNewline ? line.text : line.text.trimStart(),
    )
  }

  public getWrappedLines(): WrappedLine[] {
    return this.wrappedLines
  }

  private getLine(line: number): WrappedLine {
    const lines = this.wrappedLines
    return lines[Math.max(0, Math.min(line, lines.length - 1))]!
  }

  public getOffsetFromPosition(position: Position): number {
    const wrappedLine = this.getLine(position.line)

    // Handle blank lines specially
    if (wrappedLine.text.length === 0 && wrappedLine.endsWithNewline) {
      return wrappedLine.startOffset
    }

    // Account for leading whitespace
    const leadingWhitespace = wrappedLine.isPrecededByNewline
      ? 0
      : wrappedLine.text.length - wrappedLine.text.trimStart().length

    // Convert display column to string index
    const displayColumnWithLeading = position.column + leadingWhitespace
    const stringIndex = this.displayWidthToStringIndex(
      wrappedLine.text,
      displayColumnWithLeading,
    )

    // Calculate the actual offset
    const offset = wrappedLine.startOffset + stringIndex

    // For normal lines
    const lineEnd = wrappedLine.startOffset + wrappedLine.text.length

    // Don't allow going past the end of the current line into the next line
    // unless we're at the very end of the text
    let maxOffset = lineEnd
    const lineDisplayWidth = stringWidth(wrappedLine.text)
    if (wrappedLine.endsWithNewline && position.column > lineDisplayWidth) {
      // Allow positioning after the newline
      maxOffset = lineEnd + 1
    }

    return Math.min(offset, maxOffset)
  }

  public getLineLength(line: number): number {
    const wrappedLine = this.getLine(line)
    return stringWidth(wrappedLine.text)
  }

  public getPositionFromOffset(offset: number): Position {
    const lines = this.wrappedLines
    for (let line = 0; line < lines.length; line++) {
      const currentLine = lines[line]!
      const nextLine = lines[line + 1]
      if (
        offset >= currentLine.startOffset &&
        (!nextLine || offset < nextLine.startOffset)
      ) {
        // Calculate string position within the line
        const stringPosInLine = offset - currentLine.startOffset

        // Handle leading whitespace for wrapped lines
        let displayColumn: number
        if (currentLine.isPrecededByNewline) {
          // For lines preceded by newline, calculate display width directly
          displayColumn = this.stringIndexToDisplayWidth(
            currentLine.text,
            stringPosInLine,
          )
        } else {
          // For wrapped lines, we need to account for trimmed whitespace
          const leadingWhitespace =
            currentLine.text.length - currentLine.text.trimStart().length
          if (stringPosInLine < leadingWhitespace) {
            // Cursor is in the trimmed whitespace area, position at start
            displayColumn = 0
          } else {
            // Calculate display width from the trimmed text
            const trimmedText = currentLine.text.trimStart()
            const posInTrimmed = stringPosInLine - leadingWhitespace
            displayColumn = this.stringIndexToDisplayWidth(
              trimmedText,
              posInTrimmed,
            )
          }
        }

        return {
          line,
          column: Math.max(0, displayColumn),
        }
      }
    }

    // If we're past the last character, return the end of the last line
    const line = lines.length - 1
    const lastLine = this.wrappedLines[line]!
    return {
      line,
      column: stringWidth(lastLine.text),
    }
  }

  public get lineCount(): number {
    return this.wrappedLines.length
  }

  private withCache<T>(key: string, compute: () => T): T {
    const cached = this.navigationCache.get(key)
    if (cached !== undefined) return cached as T

    const result = compute()
    this.navigationCache.set(key, result as number)
    return result
  }

  nextOffset(offset: number): number {
    return this.withCache(`next:${offset}`, () => {
      const boundaries = this.getGraphemeBoundaries()
      return this.binarySearchBoundary(boundaries, offset, true)
    })
  }

  prevOffset(offset: number): number {
    if (offset <= 0) return 0

    return this.withCache(`prev:${offset}`, () => {
      const boundaries = this.getGraphemeBoundaries()
      return this.binarySearchBoundary(boundaries, offset, false)
    })
  }

  /**
   * Snap an arbitrary code-unit offset to the start of the containing grapheme.
   * If offset is already on a boundary, returns it unchanged.
   */
  snapToGraphemeBoundary(offset: number): number {
    if (offset <= 0) return 0
    if (offset >= this.text.length) return this.text.length
    const boundaries = this.getGraphemeBoundaries()
    // Binary search for largest boundary <= offset
    let lo = 0
    let hi = boundaries.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (boundaries[mid]! <= offset) lo = mid
      else hi = mid - 1
    }
    return boundaries[lo]!
  }
}
