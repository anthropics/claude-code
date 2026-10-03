import { logForDebugging } from '../../utils/debug.js'
import { truncate } from '../../utils/format.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { expandPath } from '../../utils/path.js'

const MAX_READ_BYTES = 64 * 1024

/**
 * Extracts the symbol/word at a specific position in a file.
 * Used to show context in tool use messages.
 *
 * @param filePath - The file path (absolute or relative)
 * @param line - 0-indexed line number
 * @param character - 0-indexed character position on the line
 *
 * Note: This uses synchronous file I/O because it is called from
 * renderToolUseMessage (a synchronous React render function). The read is
 * wrapped in try/catch so ENOENT and other errors fall back gracefully.
 * @returns The symbol at that position, or null if extraction fails
 */
export function getSymbolAtPosition(
  filePath: string,
  line: number,
  character: number,
): string | null {
  try {
    const fs = getFsImplementation()
    const absolutePath = expandPath(filePath)

    // Read only the first 64KB instead of the whole file. Most LSP hover/goto
    // targets are near recent edits; 64KB covers ~1000 lines of typical code.
    // If the target line is past this window we fall back to null (the UI
    // already handles that by showing `position: line:char`).
    // eslint-disable-next-line custom-rules/no-sync-fs -- called from sync React render (renderToolUseMessage)
    const { buffer, bytesRead } = fs.readSync(absolutePath, {
      length: MAX_READ_BYTES,
    })
    const content = buffer.toString('utf-8', 0, bytesRead)
    const lines = content.split('\n')

    if (line < 0 || line >= lines.length) {
      return null
    }
    // If we filled the full buffer the file continues past our window,
    // so the last split element may be truncated mid-line.
    if (bytesRead === MAX_READ_BYTES && line === lines.length - 1) {
      return null
    }

    const lineContent = lines[line]
    if (!lineContent || character < 0 || character >= lineContent.length) {
      return null
    }

    // Extract the word/symbol at the character position
    // Pattern matches:
    // - Standard identifiers: alphanumeric + underscore + dollar
    // - Rust lifetimes: 'a, 'static
    // - Rust macros: macro_name!
    // - Operators and special symbols: +, -, *, etc.
    // This is more inclusive to handle various programming languages
    const symbolPattern = /[\w$'!]+|[+\-*/%&|^~<>=]+/g
    let match: RegExpExecArray | null

    while ((match = symbolPattern.exec(lineContent)) !== null) {
      const start = match.index
      const end = start + match[0].length

      // Check if the character position falls within this match
      if (character >= start && character < end) {
        const symbol = match[0]
        // Limit length to 30 characters to avoid overly long symbols
        return truncate(symbol, 30)
      }
    }

    return null
  } catch (error) {
    // Log unexpected errors for debugging (permission issues, encoding problems, etc.)
    // Use logForDebugging since this is a display enhancement, not a critical error
    if (error instanceof Error) {
      logForDebugging(
        `Symbol extraction failed for ${filePath}:${line}:${character}: ${error.message}`,
        { level: 'warn' },
      )
    }
    // Still return null for graceful fallback to position display
    return null
  }
}
