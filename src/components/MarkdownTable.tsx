import type { Token, Tokens } from 'marked';
import React from 'react';
import stripAnsi from 'strip-ansi';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { stringWidth } from '../ink/stringWidth.js';
import { wrapAnsi } from '../ink/wrapAnsi.js';
import { Ansi, useTheme } from '../ink.js';
import type { CliHighlight } from '../utils/cliHighlight.js';
import { formatToken, padAligned } from '../utils/markdown.js';

/** Accounts for parent indentation (e.g. message dot prefix) and terminal
 *  resize races. Without enough margin the table overflows its layout box
 *  and Ink's clip truncates differently on alternating frames, causing an
 *  infinite flicker loop in scrollback. */
const SAFETY_MARGIN = 4;

/** Minimum column width to prevent degenerate layouts */
const MIN_COLUMN_WIDTH = 3;

/**
 * Maximum number of lines per row before switching to vertical format.
 * When wrapping would make rows taller than this, vertical (key-value)
 * format provides better readability.
 */
const MAX_ROW_LINES = 4;

/** ANSI escape codes for text formatting */
const ANSI_BOLD_START = '\x1b[1m';
const ANSI_BOLD_END = '\x1b[22m';
type Props = {
  token: Tokens.Table;
  highlight: CliHighlight | null;
  /** Override terminal width (useful for testing) */
  forceWidth?: number;
};

/**
 * Wrap text to fit within a given width, returning array of lines.
 * ANSI-aware: preserves styling across line breaks.
 *
 * @param hard - If true, break words that exceed width (needed when columns
 *               are narrower than the longest word). Default false.
 */
function wrapText(text: string, width: number, options?: {
  hard?: boolean;
}): string[] {
  if (width <= 0) return [text];
  // Strip trailing whitespace/newlines before wrapping.
  // formatToken() adds EOL to paragraphs and other token types,
  // which would otherwise create extra blank lines in table cells.
  const trimmedText = text.trimEnd();
  const wrapped = wrapAnsi(trimmedText, width, {
    hard: options?.hard ?? false,
    trim: false,
    wordWrap: true
  });
  // Filter out empty lines that result from trailing newlines or
  // multiple consecutive newlines in the source content.
  const lines = wrapped.split('\n').filter(line => line.length > 0);
  // Ensure we always return at least one line (empty string for empty cells)
  return lines.length > 0 ? lines : [''];
}

/**
 * Renders a markdown table using Ink's Box layout.
 * Handles terminal width by:
 * 1. Calculating minimum column widths based on longest word
 * 2. Distributing available space proportionally
 * 3. Wrapping text within cells (no truncation)
 * 4. Properly aligning multi-line rows with borders
 */
export function MarkdownTable({
  token,
  highlight,
  forceWidth
}: Props): React.ReactNode {
  const [theme] = useTheme();
  const {
    columns: actualTerminalWidth
  } = useTerminalSize();
  const terminalWidth = forceWidth ?? actualTerminalWidth;

  // Format cell content to ANSI string
  function formatCell(tokens: Token[] | undefined): string {
    return tokens?.map(_ => formatToken(_, theme, 0, null, null, highlight)).join('') ?? '';
  }

  // Get plain text (stripped of ANSI codes)
  function getPlainText(tokens_0: Token[] | undefined): string {
    return stripAnsi(formatCell(tokens_0));
  }

  // Get the longest word width in a cell (minimum width to avoid breaking words)
  function getMinWidth(tokens_1: Token[] | undefined): number {
    const text = getPlainText(tokens_1);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return MIN_COLUMN_WIDTH;
    return Math.max(...words.map(w_0 => stringWidth(w_0)), MIN_COLUMN_WIDTH);
  }

  // Get ideal width (full content without wrapping)
  function getIdealWidth(tokens_2: Token[] | undefined): number {
    return Math.max(stringWidth(getPlainText(tokens_2)), MIN_COLUMN_WIDTH);
  }

  // Calculate column widths
  // Step 1: Get minimum (longest word) and ideal (full content) widths
  const minWidths = token.header.map((header, colIndex) => {
    let maxMinWidth = getMinWidth(header.tokens);
    for (const row of token.rows) {
      maxMinWidth = Math.max(maxMinWidth, getMinWidth(row[colIndex]?.tokens));
    }
    return maxMinWidth;
  });
  const idealWidths = token.header.map((header_0, colIndex_0) => {
    let maxIdeal = getIdealWidth(header_0.tokens);
    for (const row_0 of token.rows) {
      maxIdeal = Math.max(maxIdeal, getIdealWidth(row_0[colIndex_0]?.tokens));
    }
    return maxIdeal;
  });

  // Step 2: Calculate available space
  // Border overhead: │ content │ content │ = 1 + (width + 3) per column
  const numCols = token.header.length;
  const borderOverhead = 1 + numCols * 3; // │ + (2 padding + 1 border) per col
  // Account for SAFETY_MARGIN to avoid triggering the fallback safety check
  const availableWidth = Math.max(terminalWidth - borderOverhead - SAFETY_MARGIN, numCols * MIN_COLUMN_WIDTH);

  // Step 3: Calculate column widths that fit available space
  const totalMin = minWidths.reduce((sum, w_1) => sum + w_1, 0);
  const totalIdeal = idealWidths.reduce((sum_0, w_2) => sum_0 + w_2, 0);

  // Track whether columns are narrower than longest words (needs hard wrap)
  let needsHardWrap = false;
  let columnWidths: number[];
  if (totalIdeal <= availableWidth) {
    // Everything fits - use ideal widths
    columnWidths = idealWidths;
  } else if (totalMin <= availableWidth) {
    // Need to shrink - give each column its min, distribute remaining space
    const extraSpace = availableWidth - totalMin;
    const overflows = idealWidths.map((ideal, i) => ideal - minWidths[i]!);
    const totalOverflow = overflows.reduce((sum_1, o) => sum_1 + o, 0);
    columnWidths = minWidths.map((min, i_0) => {
      if (totalOverflow === 0) return min;
      const extra = Math.floor(overflows[i_0]! / totalOverflow * extraSpace);
      return min + extra;
    });
  } else {
    // Table wider than terminal at minimum widths
    // Shrink columns proportionally to fit, allowing word breaks
    needsHardWrap = true;
    const scaleFactor = availableWidth / totalMin;
    columnWidths = minWidths.map(w_3 => Math.max(Math.floor(w_3 * scaleFactor), MIN_COLUMN_WIDTH));
  }

  // Step 4: Calculate max row lines to determine if vertical format is needed
  function calculateMaxRowLines(): number {
    let maxLines = 1;
    // Check header
    for (let i_1 = 0; i_1 < token.header.length; i_1++) {
      const content = formatCell(token.header[i_1]!.tokens);
      const wrapped = wrapText(content, columnWidths[i_1]!, {
        hard: needsHardWrap
      });
      maxLines = Math.max(maxLines, wrapped.length);
    }
    // Check rows
    for (const row_1 of token.rows) {
      for (let i_2 = 0; i_2 < row_1.length; i_2++) {
        const content_0 = formatCell(row_1[i_2]?.tokens);
        const wrapped_0 = wrapText(content_0, columnWidths[i_2]!, {
          hard: needsHardWrap
        });
        maxLines = Math.max(maxLines, wrapped_0.length);
      }
    }
    return maxLines;
  }

  // Use vertical format if wrapping would make rows too tall
  const maxRowLines = calculateMaxRowLines();
  const useVerticalFormat = maxRowLines > MAX_ROW_LINES;

  // Render a single row with potential multi-line cells
  // Returns an array of strings, one per line of the row
  function renderRowLines(cells: Array<{
    tokens?: Token[];
  }>, isHeader: boolean): string[] {
    // Get wrapped lines for each cell (preserving ANSI formatting)
    const cellLines = cells.map((cell, colIndex_1) => {
      const formattedText = formatCell(cell.tokens);
      const width = columnWidths[colIndex_1]!;
      return wrapText(formattedText, width, {
        hard: needsHardWrap
      });
    });

    // Find max number of lines in this row
    const maxLines_0 = Math.max(...cellLines.map(lines => lines.length), 1);

    // Calculate vertical offset for each cell (to center vertically)
    const verticalOffsets = cellLines.map(lines_0 => Math.floor((maxLines_0 - lines_0.length) / 2));

    // Build each line of the row as a single string
    const result: string[] = [];
    for (let lineIdx = 0; lineIdx < maxLines_0; lineIdx++) {
      let line = '│';
      for (let colIndex_2 = 0; colIndex_2 < cells.length; colIndex_2++) {
        const lines_1 = cellLines[colIndex_2]!;
        const offset = verticalOffsets[colIndex_2]!;
        const contentLineIdx = lineIdx - offset;
        const lineText = contentLineIdx >= 0 && contentLineIdx < lines_1.length ? lines_1[contentLineIdx]! : '';
        const width_0 = columnWidths[colIndex_2]!;
        // Headers always centered; data uses table alignment
        const align = isHeader ? 'center' : token.align?.[colIndex_2] ?? 'left';
        line += ' ' + padAligned(lineText, stringWidth(lineText), width_0, align) + ' │';
      }
      result.push(line);
    }
    return result;
  }

  // Render horizontal border as a single string
  function renderBorderLine(type: 'top' | 'middle' | 'bottom'): string {
    const [left, mid, cross, right] = {
      top: ['┌', '─', '┬', '┐'],
      middle: ['├', '─', '┼', '┤'],
      bottom: ['└', '─', '┴', '┘']
    }[type] as [string, string, string, string];
    let line_0 = left;
    columnWidths.forEach((width_1, colIndex_3) => {
      line_0 += mid.repeat(width_1 + 2);
      line_0 += colIndex_3 < columnWidths.length - 1 ? cross : right;
    });
    return line_0;
  }

  // Render vertical format (key-value pairs) for extra-narrow terminals
  function renderVerticalFormat(): string {
    const lines_2: string[] = [];
    const headers = token.header.map(h => getPlainText(h.tokens));
    const separatorWidth = Math.min(terminalWidth - 1, 40);
    const separator = '─'.repeat(separatorWidth);
    // Small indent for wrapped lines (just 2 spaces)
    const wrapIndent = '  ';
    token.rows.forEach((row_2, rowIndex) => {
      if (rowIndex > 0) {
        lines_2.push(separator);
      }
      row_2.forEach((cell_0, colIndex_4) => {
        const label = headers[colIndex_4] || `Column ${colIndex_4 + 1}`;
        // Clean value: trim, remove extra internal whitespace/newlines
        const rawValue = formatCell(cell_0.tokens).trimEnd();
        const value = rawValue.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

        // Wrap value to fit terminal, accounting for label on first line
        const firstLineWidth = terminalWidth - stringWidth(label) - 3;
        const subsequentLineWidth = terminalWidth - wrapIndent.length - 1;

        // Two-pass wrap: first line is narrower (label takes space),
        // continuation lines get the full width minus indent.
        const firstPassLines = wrapText(value, Math.max(firstLineWidth, 10));
        const firstLine = firstPassLines[0] || '';
        let wrappedValue: string[];
        if (firstPassLines.length <= 1 || subsequentLineWidth <= firstLineWidth) {
          wrappedValue = firstPassLines;
        } else {
          // Re-join remaining text and re-wrap to the wider continuation width
          const remainingText = firstPassLines.slice(1).map(l => l.trim()).join(' ');
          const rewrapped = wrapText(remainingText, subsequentLineWidth);
          wrappedValue = [firstLine, ...rewrapped];
        }

        // First line: bold label + value
        lines_2.push(`${ANSI_BOLD_START}${label}:${ANSI_BOLD_END} ${wrappedValue[0] || ''}`);

        // Subsequent lines with small indent (skip empty lines)
        for (let i_3 = 1; i_3 < wrappedValue.length; i_3++) {
          const line_1 = wrappedValue[i_3]!;
          if (!line_1.trim()) continue;
          lines_2.push(`${wrapIndent}${line_1}`);
        }
      });
    });
    return lines_2.join('\n');
  }

  // Choose format based on available width
  if (useVerticalFormat) {
    return <Ansi>{renderVerticalFormat()}</Ansi>;
  }

  // Build the complete horizontal table as an array of strings
  const tableLines: string[] = [];
  tableLines.push(renderBorderLine('top'));
  tableLines.push(...renderRowLines(token.header, true));
  tableLines.push(renderBorderLine('middle'));
  token.rows.forEach((row_3, rowIndex_0) => {
    tableLines.push(...renderRowLines(row_3, false));
    if (rowIndex_0 < token.rows.length - 1) {
      tableLines.push(renderBorderLine('middle'));
    }
  });
  tableLines.push(renderBorderLine('bottom'));

  // Safety check: verify no line exceeds terminal width.
  // This catches edge cases during terminal resize where calculations
  // were based on a different width than the current render target.
  const maxLineWidth = Math.max(...tableLines.map(line_2 => stringWidth(stripAnsi(line_2))));

  // If we're within SAFETY_MARGIN characters of the edge, use vertical format
  // to account for terminal resize race conditions.
  if (maxLineWidth > terminalWidth - SAFETY_MARGIN) {
    return <Ansi>{renderVerticalFormat()}</Ansi>;
  }

  // Render as a single Ansi block to prevent Ink from wrapping mid-row
  return <Ansi>{tableLines.join('\n')}</Ansi>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJUb2tlbiIsIlRva2VucyIsIlJlYWN0Iiwic3RyaXBBbnNpIiwidXNlVGVybWluYWxTaXplIiwic3RyaW5nV2lkdGgiLCJ3cmFwQW5zaSIsIkFuc2kiLCJ1c2VUaGVtZSIsIkNsaUhpZ2hsaWdodCIsImZvcm1hdFRva2VuIiwicGFkQWxpZ25lZCIsIlNBRkVUWV9NQVJHSU4iLCJNSU5fQ09MVU1OX1dJRFRIIiwiTUFYX1JPV19MSU5FUyIsIkFOU0lfQk9MRF9TVEFSVCIsIkFOU0lfQk9MRF9FTkQiLCJQcm9wcyIsInRva2VuIiwiVGFibGUiLCJoaWdobGlnaHQiLCJmb3JjZVdpZHRoIiwid3JhcFRleHQiLCJ0ZXh0Iiwid2lkdGgiLCJvcHRpb25zIiwiaGFyZCIsInRyaW1tZWRUZXh0IiwidHJpbUVuZCIsIndyYXBwZWQiLCJ0cmltIiwid29yZFdyYXAiLCJsaW5lcyIsInNwbGl0IiwiZmlsdGVyIiwibGluZSIsImxlbmd0aCIsIk1hcmtkb3duVGFibGUiLCJSZWFjdE5vZGUiLCJ0aGVtZSIsImNvbHVtbnMiLCJhY3R1YWxUZXJtaW5hbFdpZHRoIiwidGVybWluYWxXaWR0aCIsImZvcm1hdENlbGwiLCJ0b2tlbnMiLCJtYXAiLCJfIiwiam9pbiIsImdldFBsYWluVGV4dCIsImdldE1pbldpZHRoIiwid29yZHMiLCJ3IiwiTWF0aCIsIm1heCIsImdldElkZWFsV2lkdGgiLCJtaW5XaWR0aHMiLCJoZWFkZXIiLCJjb2xJbmRleCIsIm1heE1pbldpZHRoIiwicm93Iiwicm93cyIsImlkZWFsV2lkdGhzIiwibWF4SWRlYWwiLCJudW1Db2xzIiwiYm9yZGVyT3ZlcmhlYWQiLCJhdmFpbGFibGVXaWR0aCIsInRvdGFsTWluIiwicmVkdWNlIiwic3VtIiwidG90YWxJZGVhbCIsIm5lZWRzSGFyZFdyYXAiLCJjb2x1bW5XaWR0aHMiLCJleHRyYVNwYWNlIiwib3ZlcmZsb3dzIiwiaWRlYWwiLCJpIiwidG90YWxPdmVyZmxvdyIsIm8iLCJtaW4iLCJleHRyYSIsImZsb29yIiwic2NhbGVGYWN0b3IiLCJjYWxjdWxhdGVNYXhSb3dMaW5lcyIsIm1heExpbmVzIiwiY29udGVudCIsIm1heFJvd0xpbmVzIiwidXNlVmVydGljYWxGb3JtYXQiLCJyZW5kZXJSb3dMaW5lcyIsImNlbGxzIiwiQXJyYXkiLCJpc0hlYWRlciIsImNlbGxMaW5lcyIsImNlbGwiLCJmb3JtYXR0ZWRUZXh0IiwidmVydGljYWxPZmZzZXRzIiwicmVzdWx0IiwibGluZUlkeCIsIm9mZnNldCIsImNvbnRlbnRMaW5lSWR4IiwibGluZVRleHQiLCJhbGlnbiIsInB1c2giLCJyZW5kZXJCb3JkZXJMaW5lIiwidHlwZSIsImxlZnQiLCJtaWQiLCJjcm9zcyIsInJpZ2h0IiwidG9wIiwibWlkZGxlIiwiYm90dG9tIiwiZm9yRWFjaCIsInJlcGVhdCIsInJlbmRlclZlcnRpY2FsRm9ybWF0IiwiaGVhZGVycyIsImgiLCJzZXBhcmF0b3JXaWR0aCIsInNlcGFyYXRvciIsIndyYXBJbmRlbnQiLCJyb3dJbmRleCIsImxhYmVsIiwicmF3VmFsdWUiLCJ2YWx1ZSIsInJlcGxhY2UiLCJmaXJzdExpbmVXaWR0aCIsInN1YnNlcXVlbnRMaW5lV2lkdGgiLCJmaXJzdFBhc3NMaW5lcyIsImZpcnN0TGluZSIsIndyYXBwZWRWYWx1ZSIsInJlbWFpbmluZ1RleHQiLCJzbGljZSIsImwiLCJyZXdyYXBwZWQiLCJ0YWJsZUxpbmVzIiwibWF4TGluZVdpZHRoIl0sInNvdXJjZXMiOlsiTWFya2Rvd25UYWJsZS50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgeyBUb2tlbiwgVG9rZW5zIH0gZnJvbSAnbWFya2VkJ1xuaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHN0cmlwQW5zaSBmcm9tICdzdHJpcC1hbnNpJ1xuaW1wb3J0IHsgdXNlVGVybWluYWxTaXplIH0gZnJvbSAnLi4vaG9va3MvdXNlVGVybWluYWxTaXplLmpzJ1xuaW1wb3J0IHsgc3RyaW5nV2lkdGggfSBmcm9tICcuLi9pbmsvc3RyaW5nV2lkdGguanMnXG5pbXBvcnQgeyB3cmFwQW5zaSB9IGZyb20gJy4uL2luay93cmFwQW5zaS5qcydcbmltcG9ydCB7IEFuc2ksIHVzZVRoZW1lIH0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0IHR5cGUgeyBDbGlIaWdobGlnaHQgfSBmcm9tICcuLi91dGlscy9jbGlIaWdobGlnaHQuanMnXG5pbXBvcnQgeyBmb3JtYXRUb2tlbiwgcGFkQWxpZ25lZCB9IGZyb20gJy4uL3V0aWxzL21hcmtkb3duLmpzJ1xuXG4vKiogQWNjb3VudHMgZm9yIHBhcmVudCBpbmRlbnRhdGlvbiAoZS5nLiBtZXNzYWdlIGRvdCBwcmVmaXgpIGFuZCB0ZXJtaW5hbFxuICogIHJlc2l6ZSByYWNlcy4gV2l0aG91dCBlbm91Z2ggbWFyZ2luIHRoZSB0YWJsZSBvdmVyZmxvd3MgaXRzIGxheW91dCBib3hcbiAqICBhbmQgSW5rJ3MgY2xpcCB0cnVuY2F0ZXMgZGlmZmVyZW50bHkgb24gYWx0ZXJuYXRpbmcgZnJhbWVzLCBjYXVzaW5nIGFuXG4gKiAgaW5maW5pdGUgZmxpY2tlciBsb29wIGluIHNjcm9sbGJhY2suICovXG5jb25zdCBTQUZFVFlfTUFSR0lOID0gNFxuXG4vKiogTWluaW11bSBjb2x1bW4gd2lkdGggdG8gcHJldmVudCBkZWdlbmVyYXRlIGxheW91dHMgKi9cbmNvbnN0IE1JTl9DT0xVTU5fV0lEVEggPSAzXG5cbi8qKlxuICogTWF4aW11bSBudW1iZXIgb2YgbGluZXMgcGVyIHJvdyBiZWZvcmUgc3dpdGNoaW5nIHRvIHZlcnRpY2FsIGZvcm1hdC5cbiAqIFdoZW4gd3JhcHBpbmcgd291bGQgbWFrZSByb3dzIHRhbGxlciB0aGFuIHRoaXMsIHZlcnRpY2FsIChrZXktdmFsdWUpXG4gKiBmb3JtYXQgcHJvdmlkZXMgYmV0dGVyIHJlYWRhYmlsaXR5LlxuICovXG5jb25zdCBNQVhfUk9XX0xJTkVTID0gNFxuXG4vKiogQU5TSSBlc2NhcGUgY29kZXMgZm9yIHRleHQgZm9ybWF0dGluZyAqL1xuY29uc3QgQU5TSV9CT0xEX1NUQVJUID0gJ1xceDFiWzFtJ1xuY29uc3QgQU5TSV9CT0xEX0VORCA9ICdcXHgxYlsyMm0nXG5cbnR5cGUgUHJvcHMgPSB7XG4gIHRva2VuOiBUb2tlbnMuVGFibGVcbiAgaGlnaGxpZ2h0OiBDbGlIaWdobGlnaHQgfCBudWxsXG4gIC8qKiBPdmVycmlkZSB0ZXJtaW5hbCB3aWR0aCAodXNlZnVsIGZvciB0ZXN0aW5nKSAqL1xuICBmb3JjZVdpZHRoPzogbnVtYmVyXG59XG5cbi8qKlxuICogV3JhcCB0ZXh0IHRvIGZpdCB3aXRoaW4gYSBnaXZlbiB3aWR0aCwgcmV0dXJuaW5nIGFycmF5IG9mIGxpbmVzLlxuICogQU5TSS1hd2FyZTogcHJlc2VydmVzIHN0eWxpbmcgYWNyb3NzIGxpbmUgYnJlYWtzLlxuICpcbiAqIEBwYXJhbSBoYXJkIC0gSWYgdHJ1ZSwgYnJlYWsgd29yZHMgdGhhdCBleGNlZWQgd2lkdGggKG5lZWRlZCB3aGVuIGNvbHVtbnNcbiAqICAgICAgICAgICAgICAgYXJlIG5hcnJvd2VyIHRoYW4gdGhlIGxvbmdlc3Qgd29yZCkuIERlZmF1bHQgZmFsc2UuXG4gKi9cbmZ1bmN0aW9uIHdyYXBUZXh0KFxuICB0ZXh0OiBzdHJpbmcsXG4gIHdpZHRoOiBudW1iZXIsXG4gIG9wdGlvbnM/OiB7IGhhcmQ/OiBib29sZWFuIH0sXG4pOiBzdHJpbmdbXSB7XG4gIGlmICh3aWR0aCA8PSAwKSByZXR1cm4gW3RleHRdXG4gIC8vIFN0cmlwIHRyYWlsaW5nIHdoaXRlc3BhY2UvbmV3bGluZXMgYmVmb3JlIHdyYXBwaW5nLlxuICAvLyBmb3JtYXRUb2tlbigpIGFkZHMgRU9MIHRvIHBhcmFncmFwaHMgYW5kIG90aGVyIHRva2VuIHR5cGVzLFxuICAvLyB3aGljaCB3b3VsZCBvdGhlcndpc2UgY3JlYXRlIGV4dHJhIGJsYW5rIGxpbmVzIGluIHRhYmxlIGNlbGxzLlxuICBjb25zdCB0cmltbWVkVGV4dCA9IHRleHQudHJpbUVuZCgpXG4gIGNvbnN0IHdyYXBwZWQgPSB3cmFwQW5zaSh0cmltbWVkVGV4dCwgd2lkdGgsIHtcbiAgICBoYXJkOiBvcHRpb25zPy5oYXJkID8/IGZhbHNlLFxuICAgIHRyaW06IGZhbHNlLFxuICAgIHdvcmRXcmFwOiB0cnVlLFxuICB9KVxuICAvLyBGaWx0ZXIgb3V0IGVtcHR5IGxpbmVzIHRoYXQgcmVzdWx0IGZyb20gdHJhaWxpbmcgbmV3bGluZXMgb3JcbiAgLy8gbXVsdGlwbGUgY29uc2VjdXRpdmUgbmV3bGluZXMgaW4gdGhlIHNvdXJjZSBjb250ZW50LlxuICBjb25zdCBsaW5lcyA9IHdyYXBwZWQuc3BsaXQoJ1xcbicpLmZpbHRlcihsaW5lID0+IGxpbmUubGVuZ3RoID4gMClcbiAgLy8gRW5zdXJlIHdlIGFsd2F5cyByZXR1cm4gYXQgbGVhc3Qgb25lIGxpbmUgKGVtcHR5IHN0cmluZyBmb3IgZW1wdHkgY2VsbHMpXG4gIHJldHVybiBsaW5lcy5sZW5ndGggPiAwID8gbGluZXMgOiBbJyddXG59XG5cbi8qKlxuICogUmVuZGVycyBhIG1hcmtkb3duIHRhYmxlIHVzaW5nIEluaydzIEJveCBsYXlvdXQuXG4gKiBIYW5kbGVzIHRlcm1pbmFsIHdpZHRoIGJ5OlxuICogMS4gQ2FsY3VsYXRpbmcgbWluaW11bSBjb2x1bW4gd2lkdGhzIGJhc2VkIG9uIGxvbmdlc3Qgd29yZFxuICogMi4gRGlzdHJpYnV0aW5nIGF2YWlsYWJsZSBzcGFjZSBwcm9wb3J0aW9uYWxseVxuICogMy4gV3JhcHBpbmcgdGV4dCB3aXRoaW4gY2VsbHMgKG5vIHRydW5jYXRpb24pXG4gKiA0LiBQcm9wZXJseSBhbGlnbmluZyBtdWx0aS1saW5lIHJvd3Mgd2l0aCBib3JkZXJzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBNYXJrZG93blRhYmxlKHtcbiAgdG9rZW4sXG4gIGhpZ2hsaWdodCxcbiAgZm9yY2VXaWR0aCxcbn06IFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgW3RoZW1lXSA9IHVzZVRoZW1lKClcbiAgY29uc3QgeyBjb2x1bW5zOiBhY3R1YWxUZXJtaW5hbFdpZHRoIH0gPSB1c2VUZXJtaW5hbFNpemUoKVxuICBjb25zdCB0ZXJtaW5hbFdpZHRoID0gZm9yY2VXaWR0aCA/PyBhY3R1YWxUZXJtaW5hbFdpZHRoXG5cbiAgLy8gRm9ybWF0IGNlbGwgY29udGVudCB0byBBTlNJIHN0cmluZ1xuICBmdW5jdGlvbiBmb3JtYXRDZWxsKHRva2VuczogVG9rZW5bXSB8IHVuZGVmaW5lZCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRva2Vuc1xuICAgICAgICA/Lm1hcChfID0+IGZvcm1hdFRva2VuKF8sIHRoZW1lLCAwLCBudWxsLCBudWxsLCBoaWdobGlnaHQpKVxuICAgICAgICAuam9pbignJykgPz8gJydcbiAgICApXG4gIH1cblxuICAvLyBHZXQgcGxhaW4gdGV4dCAoc3RyaXBwZWQgb2YgQU5TSSBjb2RlcylcbiAgZnVuY3Rpb24gZ2V0UGxhaW5UZXh0KHRva2VuczogVG9rZW5bXSB8IHVuZGVmaW5lZCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHN0cmlwQW5zaShmb3JtYXRDZWxsKHRva2VucykpXG4gIH1cblxuICAvLyBHZXQgdGhlIGxvbmdlc3Qgd29yZCB3aWR0aCBpbiBhIGNlbGwgKG1pbmltdW0gd2lkdGggdG8gYXZvaWQgYnJlYWtpbmcgd29yZHMpXG4gIGZ1bmN0aW9uIGdldE1pbldpZHRoKHRva2VuczogVG9rZW5bXSB8IHVuZGVmaW5lZCk6IG51bWJlciB7XG4gICAgY29uc3QgdGV4dCA9IGdldFBsYWluVGV4dCh0b2tlbnMpXG4gICAgY29uc3Qgd29yZHMgPSB0ZXh0LnNwbGl0KC9cXHMrLykuZmlsdGVyKHcgPT4gdy5sZW5ndGggPiAwKVxuICAgIGlmICh3b3Jkcy5sZW5ndGggPT09IDApIHJldHVybiBNSU5fQ09MVU1OX1dJRFRIXG4gICAgcmV0dXJuIE1hdGgubWF4KC4uLndvcmRzLm1hcCh3ID0+IHN0cmluZ1dpZHRoKHcpKSwgTUlOX0NPTFVNTl9XSURUSClcbiAgfVxuXG4gIC8vIEdldCBpZGVhbCB3aWR0aCAoZnVsbCBjb250ZW50IHdpdGhvdXQgd3JhcHBpbmcpXG4gIGZ1bmN0aW9uIGdldElkZWFsV2lkdGgodG9rZW5zOiBUb2tlbltdIHwgdW5kZWZpbmVkKTogbnVtYmVyIHtcbiAgICByZXR1cm4gTWF0aC5tYXgoc3RyaW5nV2lkdGgoZ2V0UGxhaW5UZXh0KHRva2VucykpLCBNSU5fQ09MVU1OX1dJRFRIKVxuICB9XG5cbiAgLy8gQ2FsY3VsYXRlIGNvbHVtbiB3aWR0aHNcbiAgLy8gU3RlcCAxOiBHZXQgbWluaW11bSAobG9uZ2VzdCB3b3JkKSBhbmQgaWRlYWwgKGZ1bGwgY29udGVudCkgd2lkdGhzXG4gIGNvbnN0IG1pbldpZHRocyA9IHRva2VuLmhlYWRlci5tYXAoKGhlYWRlciwgY29sSW5kZXgpID0+IHtcbiAgICBsZXQgbWF4TWluV2lkdGggPSBnZXRNaW5XaWR0aChoZWFkZXIudG9rZW5zKVxuICAgIGZvciAoY29uc3Qgcm93IG9mIHRva2VuLnJvd3MpIHtcbiAgICAgIG1heE1pbldpZHRoID0gTWF0aC5tYXgobWF4TWluV2lkdGgsIGdldE1pbldpZHRoKHJvd1tjb2xJbmRleF0/LnRva2VucykpXG4gICAgfVxuICAgIHJldHVybiBtYXhNaW5XaWR0aFxuICB9KVxuXG4gIGNvbnN0IGlkZWFsV2lkdGhzID0gdG9rZW4uaGVhZGVyLm1hcCgoaGVhZGVyLCBjb2xJbmRleCkgPT4ge1xuICAgIGxldCBtYXhJZGVhbCA9IGdldElkZWFsV2lkdGgoaGVhZGVyLnRva2VucylcbiAgICBmb3IgKGNvbnN0IHJvdyBvZiB0b2tlbi5yb3dzKSB7XG4gICAgICBtYXhJZGVhbCA9IE1hdGgubWF4KG1heElkZWFsLCBnZXRJZGVhbFdpZHRoKHJvd1tjb2xJbmRleF0/LnRva2VucykpXG4gICAgfVxuICAgIHJldHVybiBtYXhJZGVhbFxuICB9KVxuXG4gIC8vIFN0ZXAgMjogQ2FsY3VsYXRlIGF2YWlsYWJsZSBzcGFjZVxuICAvLyBCb3JkZXIgb3ZlcmhlYWQ6IOKUgiBjb250ZW50IOKUgiBjb250ZW50IOKUgiA9IDEgKyAod2lkdGggKyAzKSBwZXIgY29sdW1uXG4gIGNvbnN0IG51bUNvbHMgPSB0b2tlbi5oZWFkZXIubGVuZ3RoXG4gIGNvbnN0IGJvcmRlck92ZXJoZWFkID0gMSArIG51bUNvbHMgKiAzIC8vIOKUgiArICgyIHBhZGRpbmcgKyAxIGJvcmRlcikgcGVyIGNvbFxuICAvLyBBY2NvdW50IGZvciBTQUZFVFlfTUFSR0lOIHRvIGF2b2lkIHRyaWdnZXJpbmcgdGhlIGZhbGxiYWNrIHNhZmV0eSBjaGVja1xuICBjb25zdCBhdmFpbGFibGVXaWR0aCA9IE1hdGgubWF4KFxuICAgIHRlcm1pbmFsV2lkdGggLSBib3JkZXJPdmVyaGVhZCAtIFNBRkVUWV9NQVJHSU4sXG4gICAgbnVtQ29scyAqIE1JTl9DT0xVTU5fV0lEVEgsXG4gIClcblxuICAvLyBTdGVwIDM6IENhbGN1bGF0ZSBjb2x1bW4gd2lkdGhzIHRoYXQgZml0IGF2YWlsYWJsZSBzcGFjZVxuICBjb25zdCB0b3RhbE1pbiA9IG1pbldpZHRocy5yZWR1Y2UoKHN1bSwgdykgPT4gc3VtICsgdywgMClcbiAgY29uc3QgdG90YWxJZGVhbCA9IGlkZWFsV2lkdGhzLnJlZHVjZSgoc3VtLCB3KSA9PiBzdW0gKyB3LCAwKVxuXG4gIC8vIFRyYWNrIHdoZXRoZXIgY29sdW1ucyBhcmUgbmFycm93ZXIgdGhhbiBsb25nZXN0IHdvcmRzIChuZWVkcyBoYXJkIHdyYXApXG4gIGxldCBuZWVkc0hhcmRXcmFwID0gZmFsc2VcblxuICBsZXQgY29sdW1uV2lkdGhzOiBudW1iZXJbXVxuICBpZiAodG90YWxJZGVhbCA8PSBhdmFpbGFibGVXaWR0aCkge1xuICAgIC8vIEV2ZXJ5dGhpbmcgZml0cyAtIHVzZSBpZGVhbCB3aWR0aHNcbiAgICBjb2x1bW5XaWR0aHMgPSBpZGVhbFdpZHRoc1xuICB9IGVsc2UgaWYgKHRvdGFsTWluIDw9IGF2YWlsYWJsZVdpZHRoKSB7XG4gICAgLy8gTmVlZCB0byBzaHJpbmsgLSBnaXZlIGVhY2ggY29sdW1uIGl0cyBtaW4sIGRpc3RyaWJ1dGUgcmVtYWluaW5nIHNwYWNlXG4gICAgY29uc3QgZXh0cmFTcGFjZSA9IGF2YWlsYWJsZVdpZHRoIC0gdG90YWxNaW5cbiAgICBjb25zdCBvdmVyZmxvd3MgPSBpZGVhbFdpZHRocy5tYXAoKGlkZWFsLCBpKSA9PiBpZGVhbCAtIG1pbldpZHRoc1tpXSEpXG4gICAgY29uc3QgdG90YWxPdmVyZmxvdyA9IG92ZXJmbG93cy5yZWR1Y2UoKHN1bSwgbykgPT4gc3VtICsgbywgMClcblxuICAgIGNvbHVtbldpZHRocyA9IG1pbldpZHRocy5tYXAoKG1pbiwgaSkgPT4ge1xuICAgICAgaWYgKHRvdGFsT3ZlcmZsb3cgPT09IDApIHJldHVybiBtaW5cbiAgICAgIGNvbnN0IGV4dHJhID0gTWF0aC5mbG9vcigob3ZlcmZsb3dzW2ldISAvIHRvdGFsT3ZlcmZsb3cpICogZXh0cmFTcGFjZSlcbiAgICAgIHJldHVybiBtaW4gKyBleHRyYVxuICAgIH0pXG4gIH0gZWxzZSB7XG4gICAgLy8gVGFibGUgd2lkZXIgdGhhbiB0ZXJtaW5hbCBhdCBtaW5pbXVtIHdpZHRoc1xuICAgIC8vIFNocmluayBjb2x1bW5zIHByb3BvcnRpb25hbGx5IHRvIGZpdCwgYWxsb3dpbmcgd29yZCBicmVha3NcbiAgICBuZWVkc0hhcmRXcmFwID0gdHJ1ZVxuICAgIGNvbnN0IHNjYWxlRmFjdG9yID0gYXZhaWxhYmxlV2lkdGggLyB0b3RhbE1pblxuICAgIGNvbHVtbldpZHRocyA9IG1pbldpZHRocy5tYXAodyA9PlxuICAgICAgTWF0aC5tYXgoTWF0aC5mbG9vcih3ICogc2NhbGVGYWN0b3IpLCBNSU5fQ09MVU1OX1dJRFRIKSxcbiAgICApXG4gIH1cblxuICAvLyBTdGVwIDQ6IENhbGN1bGF0ZSBtYXggcm93IGxpbmVzIHRvIGRldGVybWluZSBpZiB2ZXJ0aWNhbCBmb3JtYXQgaXMgbmVlZGVkXG4gIGZ1bmN0aW9uIGNhbGN1bGF0ZU1heFJvd0xpbmVzKCk6IG51bWJlciB7XG4gICAgbGV0IG1heExpbmVzID0gMVxuICAgIC8vIENoZWNrIGhlYWRlclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdG9rZW4uaGVhZGVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gZm9ybWF0Q2VsbCh0b2tlbi5oZWFkZXJbaV0hLnRva2VucylcbiAgICAgIGNvbnN0IHdyYXBwZWQgPSB3cmFwVGV4dChjb250ZW50LCBjb2x1bW5XaWR0aHNbaV0hLCB7XG4gICAgICAgIGhhcmQ6IG5lZWRzSGFyZFdyYXAsXG4gICAgICB9KVxuICAgICAgbWF4TGluZXMgPSBNYXRoLm1heChtYXhMaW5lcywgd3JhcHBlZC5sZW5ndGgpXG4gICAgfVxuICAgIC8vIENoZWNrIHJvd3NcbiAgICBmb3IgKGNvbnN0IHJvdyBvZiB0b2tlbi5yb3dzKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJvdy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gZm9ybWF0Q2VsbChyb3dbaV0/LnRva2VucylcbiAgICAgICAgY29uc3Qgd3JhcHBlZCA9IHdyYXBUZXh0KGNvbnRlbnQsIGNvbHVtbldpZHRoc1tpXSEsIHtcbiAgICAgICAgICBoYXJkOiBuZWVkc0hhcmRXcmFwLFxuICAgICAgICB9KVxuICAgICAgICBtYXhMaW5lcyA9IE1hdGgubWF4KG1heExpbmVzLCB3cmFwcGVkLmxlbmd0aClcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG1heExpbmVzXG4gIH1cblxuICAvLyBVc2UgdmVydGljYWwgZm9ybWF0IGlmIHdyYXBwaW5nIHdvdWxkIG1ha2Ugcm93cyB0b28gdGFsbFxuICBjb25zdCBtYXhSb3dMaW5lcyA9IGNhbGN1bGF0ZU1heFJvd0xpbmVzKClcbiAgY29uc3QgdXNlVmVydGljYWxGb3JtYXQgPSBtYXhSb3dMaW5lcyA+IE1BWF9ST1dfTElORVNcblxuICAvLyBSZW5kZXIgYSBzaW5nbGUgcm93IHdpdGggcG90ZW50aWFsIG11bHRpLWxpbmUgY2VsbHNcbiAgLy8gUmV0dXJucyBhbiBhcnJheSBvZiBzdHJpbmdzLCBvbmUgcGVyIGxpbmUgb2YgdGhlIHJvd1xuICBmdW5jdGlvbiByZW5kZXJSb3dMaW5lcyhcbiAgICBjZWxsczogQXJyYXk8eyB0b2tlbnM/OiBUb2tlbltdIH0+LFxuICAgIGlzSGVhZGVyOiBib29sZWFuLFxuICApOiBzdHJpbmdbXSB7XG4gICAgLy8gR2V0IHdyYXBwZWQgbGluZXMgZm9yIGVhY2ggY2VsbCAocHJlc2VydmluZyBBTlNJIGZvcm1hdHRpbmcpXG4gICAgY29uc3QgY2VsbExpbmVzID0gY2VsbHMubWFwKChjZWxsLCBjb2xJbmRleCkgPT4ge1xuICAgICAgY29uc3QgZm9ybWF0dGVkVGV4dCA9IGZvcm1hdENlbGwoY2VsbC50b2tlbnMpXG4gICAgICBjb25zdCB3aWR0aCA9IGNvbHVtbldpZHRoc1tjb2xJbmRleF0hXG4gICAgICByZXR1cm4gd3JhcFRleHQoZm9ybWF0dGVkVGV4dCwgd2lkdGgsIHsgaGFyZDogbmVlZHNIYXJkV3JhcCB9KVxuICAgIH0pXG5cbiAgICAvLyBGaW5kIG1heCBudW1iZXIgb2YgbGluZXMgaW4gdGhpcyByb3dcbiAgICBjb25zdCBtYXhMaW5lcyA9IE1hdGgubWF4KC4uLmNlbGxMaW5lcy5tYXAobGluZXMgPT4gbGluZXMubGVuZ3RoKSwgMSlcblxuICAgIC8vIENhbGN1bGF0ZSB2ZXJ0aWNhbCBvZmZzZXQgZm9yIGVhY2ggY2VsbCAodG8gY2VudGVyIHZlcnRpY2FsbHkpXG4gICAgY29uc3QgdmVydGljYWxPZmZzZXRzID0gY2VsbExpbmVzLm1hcChsaW5lcyA9PlxuICAgICAgTWF0aC5mbG9vcigobWF4TGluZXMgLSBsaW5lcy5sZW5ndGgpIC8gMiksXG4gICAgKVxuXG4gICAgLy8gQnVpbGQgZWFjaCBsaW5lIG9mIHRoZSByb3cgYXMgYSBzaW5nbGUgc3RyaW5nXG4gICAgY29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdXG4gICAgZm9yIChsZXQgbGluZUlkeCA9IDA7IGxpbmVJZHggPCBtYXhMaW5lczsgbGluZUlkeCsrKSB7XG4gICAgICBsZXQgbGluZSA9ICfilIInXG4gICAgICBmb3IgKGxldCBjb2xJbmRleCA9IDA7IGNvbEluZGV4IDwgY2VsbHMubGVuZ3RoOyBjb2xJbmRleCsrKSB7XG4gICAgICAgIGNvbnN0IGxpbmVzID0gY2VsbExpbmVzW2NvbEluZGV4XSFcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gdmVydGljYWxPZmZzZXRzW2NvbEluZGV4XSFcbiAgICAgICAgY29uc3QgY29udGVudExpbmVJZHggPSBsaW5lSWR4IC0gb2Zmc2V0XG4gICAgICAgIGNvbnN0IGxpbmVUZXh0ID1cbiAgICAgICAgICBjb250ZW50TGluZUlkeCA+PSAwICYmIGNvbnRlbnRMaW5lSWR4IDwgbGluZXMubGVuZ3RoXG4gICAgICAgICAgICA/IGxpbmVzW2NvbnRlbnRMaW5lSWR4XSFcbiAgICAgICAgICAgIDogJydcbiAgICAgICAgY29uc3Qgd2lkdGggPSBjb2x1bW5XaWR0aHNbY29sSW5kZXhdIVxuICAgICAgICAvLyBIZWFkZXJzIGFsd2F5cyBjZW50ZXJlZDsgZGF0YSB1c2VzIHRhYmxlIGFsaWdubWVudFxuICAgICAgICBjb25zdCBhbGlnbiA9IGlzSGVhZGVyID8gJ2NlbnRlcicgOiAodG9rZW4uYWxpZ24/Lltjb2xJbmRleF0gPz8gJ2xlZnQnKVxuXG4gICAgICAgIGxpbmUgKz1cbiAgICAgICAgICAnICcgKyBwYWRBbGlnbmVkKGxpbmVUZXh0LCBzdHJpbmdXaWR0aChsaW5lVGV4dCksIHdpZHRoLCBhbGlnbikgKyAnIOKUgidcbiAgICAgIH1cbiAgICAgIHJlc3VsdC5wdXNoKGxpbmUpXG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdFxuICB9XG5cbiAgLy8gUmVuZGVyIGhvcml6b250YWwgYm9yZGVyIGFzIGEgc2luZ2xlIHN0cmluZ1xuICBmdW5jdGlvbiByZW5kZXJCb3JkZXJMaW5lKHR5cGU6ICd0b3AnIHwgJ21pZGRsZScgfCAnYm90dG9tJyk6IHN0cmluZyB7XG4gICAgY29uc3QgW2xlZnQsIG1pZCwgY3Jvc3MsIHJpZ2h0XSA9IHtcbiAgICAgIHRvcDogWyfilIwnLCAn4pSAJywgJ+KUrCcsICfilJAnXSxcbiAgICAgIG1pZGRsZTogWyfilJwnLCAn4pSAJywgJ+KUvCcsICfilKQnXSxcbiAgICAgIGJvdHRvbTogWyfilJQnLCAn4pSAJywgJ+KUtCcsICfilJgnXSxcbiAgICB9W3R5cGVdIGFzIFtzdHJpbmcsIHN0cmluZywgc3RyaW5nLCBzdHJpbmddXG5cbiAgICBsZXQgbGluZSA9IGxlZnRcbiAgICBjb2x1bW5XaWR0aHMuZm9yRWFjaCgod2lkdGgsIGNvbEluZGV4KSA9PiB7XG4gICAgICBsaW5lICs9IG1pZC5yZXBlYXQod2lkdGggKyAyKVxuICAgICAgbGluZSArPSBjb2xJbmRleCA8IGNvbHVtbldpZHRocy5sZW5ndGggLSAxID8gY3Jvc3MgOiByaWdodFxuICAgIH0pXG4gICAgcmV0dXJuIGxpbmVcbiAgfVxuXG4gIC8vIFJlbmRlciB2ZXJ0aWNhbCBmb3JtYXQgKGtleS12YWx1ZSBwYWlycykgZm9yIGV4dHJhLW5hcnJvdyB0ZXJtaW5hbHNcbiAgZnVuY3Rpb24gcmVuZGVyVmVydGljYWxGb3JtYXQoKTogc3RyaW5nIHtcbiAgICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXVxuICAgIGNvbnN0IGhlYWRlcnMgPSB0b2tlbi5oZWFkZXIubWFwKGggPT4gZ2V0UGxhaW5UZXh0KGgudG9rZW5zKSlcbiAgICBjb25zdCBzZXBhcmF0b3JXaWR0aCA9IE1hdGgubWluKHRlcm1pbmFsV2lkdGggLSAxLCA0MClcbiAgICBjb25zdCBzZXBhcmF0b3IgPSAn4pSAJy5yZXBlYXQoc2VwYXJhdG9yV2lkdGgpXG4gICAgLy8gU21hbGwgaW5kZW50IGZvciB3cmFwcGVkIGxpbmVzIChqdXN0IDIgc3BhY2VzKVxuICAgIGNvbnN0IHdyYXBJbmRlbnQgPSAnICAnXG5cbiAgICB0b2tlbi5yb3dzLmZvckVhY2goKHJvdywgcm93SW5kZXgpID0+IHtcbiAgICAgIGlmIChyb3dJbmRleCA+IDApIHtcbiAgICAgICAgbGluZXMucHVzaChzZXBhcmF0b3IpXG4gICAgICB9XG5cbiAgICAgIHJvdy5mb3JFYWNoKChjZWxsLCBjb2xJbmRleCkgPT4ge1xuICAgICAgICBjb25zdCBsYWJlbCA9IGhlYWRlcnNbY29sSW5kZXhdIHx8IGBDb2x1bW4gJHtjb2xJbmRleCArIDF9YFxuICAgICAgICAvLyBDbGVhbiB2YWx1ZTogdHJpbSwgcmVtb3ZlIGV4dHJhIGludGVybmFsIHdoaXRlc3BhY2UvbmV3bGluZXNcbiAgICAgICAgY29uc3QgcmF3VmFsdWUgPSBmb3JtYXRDZWxsKGNlbGwudG9rZW5zKS50cmltRW5kKClcbiAgICAgICAgY29uc3QgdmFsdWUgPSByYXdWYWx1ZS5yZXBsYWNlKC9cXG4rL2csICcgJykucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKVxuXG4gICAgICAgIC8vIFdyYXAgdmFsdWUgdG8gZml0IHRlcm1pbmFsLCBhY2NvdW50aW5nIGZvciBsYWJlbCBvbiBmaXJzdCBsaW5lXG4gICAgICAgIGNvbnN0IGZpcnN0TGluZVdpZHRoID0gdGVybWluYWxXaWR0aCAtIHN0cmluZ1dpZHRoKGxhYmVsKSAtIDNcbiAgICAgICAgY29uc3Qgc3Vic2VxdWVudExpbmVXaWR0aCA9IHRlcm1pbmFsV2lkdGggLSB3cmFwSW5kZW50Lmxlbmd0aCAtIDFcblxuICAgICAgICAvLyBUd28tcGFzcyB3cmFwOiBmaXJzdCBsaW5lIGlzIG5hcnJvd2VyIChsYWJlbCB0YWtlcyBzcGFjZSksXG4gICAgICAgIC8vIGNvbnRpbnVhdGlvbiBsaW5lcyBnZXQgdGhlIGZ1bGwgd2lkdGggbWludXMgaW5kZW50LlxuICAgICAgICBjb25zdCBmaXJzdFBhc3NMaW5lcyA9IHdyYXBUZXh0KHZhbHVlLCBNYXRoLm1heChmaXJzdExpbmVXaWR0aCwgMTApKVxuICAgICAgICBjb25zdCBmaXJzdExpbmUgPSBmaXJzdFBhc3NMaW5lc1swXSB8fCAnJ1xuXG4gICAgICAgIGxldCB3cmFwcGVkVmFsdWU6IHN0cmluZ1tdXG4gICAgICAgIGlmIChcbiAgICAgICAgICBmaXJzdFBhc3NMaW5lcy5sZW5ndGggPD0gMSB8fFxuICAgICAgICAgIHN1YnNlcXVlbnRMaW5lV2lkdGggPD0gZmlyc3RMaW5lV2lkdGhcbiAgICAgICAgKSB7XG4gICAgICAgICAgd3JhcHBlZFZhbHVlID0gZmlyc3RQYXNzTGluZXNcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBSZS1qb2luIHJlbWFpbmluZyB0ZXh0IGFuZCByZS13cmFwIHRvIHRoZSB3aWRlciBjb250aW51YXRpb24gd2lkdGhcbiAgICAgICAgICBjb25zdCByZW1haW5pbmdUZXh0ID0gZmlyc3RQYXNzTGluZXNcbiAgICAgICAgICAgIC5zbGljZSgxKVxuICAgICAgICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgICAgICAgLmpvaW4oJyAnKVxuICAgICAgICAgIGNvbnN0IHJld3JhcHBlZCA9IHdyYXBUZXh0KHJlbWFpbmluZ1RleHQsIHN1YnNlcXVlbnRMaW5lV2lkdGgpXG4gICAgICAgICAgd3JhcHBlZFZhbHVlID0gW2ZpcnN0TGluZSwgLi4ucmV3cmFwcGVkXVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmlyc3QgbGluZTogYm9sZCBsYWJlbCArIHZhbHVlXG4gICAgICAgIGxpbmVzLnB1c2goXG4gICAgICAgICAgYCR7QU5TSV9CT0xEX1NUQVJUfSR7bGFiZWx9OiR7QU5TSV9CT0xEX0VORH0gJHt3cmFwcGVkVmFsdWVbMF0gfHwgJyd9YCxcbiAgICAgICAgKVxuXG4gICAgICAgIC8vIFN1YnNlcXVlbnQgbGluZXMgd2l0aCBzbWFsbCBpbmRlbnQgKHNraXAgZW1wdHkgbGluZXMpXG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgd3JhcHBlZFZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgbGluZSA9IHdyYXBwZWRWYWx1ZVtpXSFcbiAgICAgICAgICBpZiAoIWxpbmUudHJpbSgpKSBjb250aW51ZVxuICAgICAgICAgIGxpbmVzLnB1c2goYCR7d3JhcEluZGVudH0ke2xpbmV9YClcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpXG4gIH1cblxuICAvLyBDaG9vc2UgZm9ybWF0IGJhc2VkIG9uIGF2YWlsYWJsZSB3aWR0aFxuICBpZiAodXNlVmVydGljYWxGb3JtYXQpIHtcbiAgICByZXR1cm4gPEFuc2k+e3JlbmRlclZlcnRpY2FsRm9ybWF0KCl9PC9BbnNpPlxuICB9XG5cbiAgLy8gQnVpbGQgdGhlIGNvbXBsZXRlIGhvcml6b250YWwgdGFibGUgYXMgYW4gYXJyYXkgb2Ygc3RyaW5nc1xuICBjb25zdCB0YWJsZUxpbmVzOiBzdHJpbmdbXSA9IFtdXG4gIHRhYmxlTGluZXMucHVzaChyZW5kZXJCb3JkZXJMaW5lKCd0b3AnKSlcbiAgdGFibGVMaW5lcy5wdXNoKC4uLnJlbmRlclJvd0xpbmVzKHRva2VuLmhlYWRlciwgdHJ1ZSkpXG4gIHRhYmxlTGluZXMucHVzaChyZW5kZXJCb3JkZXJMaW5lKCdtaWRkbGUnKSlcbiAgdG9rZW4ucm93cy5mb3JFYWNoKChyb3csIHJvd0luZGV4KSA9PiB7XG4gICAgdGFibGVMaW5lcy5wdXNoKC4uLnJlbmRlclJvd0xpbmVzKHJvdywgZmFsc2UpKVxuICAgIGlmIChyb3dJbmRleCA8IHRva2VuLnJvd3MubGVuZ3RoIC0gMSkge1xuICAgICAgdGFibGVMaW5lcy5wdXNoKHJlbmRlckJvcmRlckxpbmUoJ21pZGRsZScpKVxuICAgIH1cbiAgfSlcbiAgdGFibGVMaW5lcy5wdXNoKHJlbmRlckJvcmRlckxpbmUoJ2JvdHRvbScpKVxuXG4gIC8vIFNhZmV0eSBjaGVjazogdmVyaWZ5IG5vIGxpbmUgZXhjZWVkcyB0ZXJtaW5hbCB3aWR0aC5cbiAgLy8gVGhpcyBjYXRjaGVzIGVkZ2UgY2FzZXMgZHVyaW5nIHRlcm1pbmFsIHJlc2l6ZSB3aGVyZSBjYWxjdWxhdGlvbnNcbiAgLy8gd2VyZSBiYXNlZCBvbiBhIGRpZmZlcmVudCB3aWR0aCB0aGFuIHRoZSBjdXJyZW50IHJlbmRlciB0YXJnZXQuXG4gIGNvbnN0IG1heExpbmVXaWR0aCA9IE1hdGgubWF4KFxuICAgIC4uLnRhYmxlTGluZXMubWFwKGxpbmUgPT4gc3RyaW5nV2lkdGgoc3RyaXBBbnNpKGxpbmUpKSksXG4gIClcblxuICAvLyBJZiB3ZSdyZSB3aXRoaW4gU0FGRVRZX01BUkdJTiBjaGFyYWN0ZXJzIG9mIHRoZSBlZGdlLCB1c2UgdmVydGljYWwgZm9ybWF0XG4gIC8vIHRvIGFjY291bnQgZm9yIHRlcm1pbmFsIHJlc2l6ZSByYWNlIGNvbmRpdGlvbnMuXG4gIGlmIChtYXhMaW5lV2lkdGggPiB0ZXJtaW5hbFdpZHRoIC0gU0FGRVRZX01BUkdJTikge1xuICAgIHJldHVybiA8QW5zaT57cmVuZGVyVmVydGljYWxGb3JtYXQoKX08L0Fuc2k+XG4gIH1cblxuICAvLyBSZW5kZXIgYXMgYSBzaW5nbGUgQW5zaSBibG9jayB0byBwcmV2ZW50IEluayBmcm9tIHdyYXBwaW5nIG1pZC1yb3dcbiAgcmV0dXJuIDxBbnNpPnt0YWJsZUxpbmVzLmpvaW4oJ1xcbicpfTwvQW5zaT5cbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUEsY0FBY0EsS0FBSyxFQUFFQyxNQUFNLFFBQVEsUUFBUTtBQUMzQyxPQUFPQyxLQUFLLE1BQU0sT0FBTztBQUN6QixPQUFPQyxTQUFTLE1BQU0sWUFBWTtBQUNsQyxTQUFTQyxlQUFlLFFBQVEsNkJBQTZCO0FBQzdELFNBQVNDLFdBQVcsUUFBUSx1QkFBdUI7QUFDbkQsU0FBU0MsUUFBUSxRQUFRLG9CQUFvQjtBQUM3QyxTQUFTQyxJQUFJLEVBQUVDLFFBQVEsUUFBUSxXQUFXO0FBQzFDLGNBQWNDLFlBQVksUUFBUSwwQkFBMEI7QUFDNUQsU0FBU0MsV0FBVyxFQUFFQyxVQUFVLFFBQVEsc0JBQXNCOztBQUU5RDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLGFBQWEsR0FBRyxDQUFDOztBQUV2QjtBQUNBLE1BQU1DLGdCQUFnQixHQUFHLENBQUM7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxhQUFhLEdBQUcsQ0FBQzs7QUFFdkI7QUFDQSxNQUFNQyxlQUFlLEdBQUcsU0FBUztBQUNqQyxNQUFNQyxhQUFhLEdBQUcsVUFBVTtBQUVoQyxLQUFLQyxLQUFLLEdBQUc7RUFDWEMsS0FBSyxFQUFFakIsTUFBTSxDQUFDa0IsS0FBSztFQUNuQkMsU0FBUyxFQUFFWCxZQUFZLEdBQUcsSUFBSTtFQUM5QjtFQUNBWSxVQUFVLENBQUMsRUFBRSxNQUFNO0FBQ3JCLENBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQyxRQUFRQSxDQUNmQyxJQUFJLEVBQUUsTUFBTSxFQUNaQyxLQUFLLEVBQUUsTUFBTSxFQUNiQyxPQUE0QixDQUFwQixFQUFFO0VBQUVDLElBQUksQ0FBQyxFQUFFLE9BQU87QUFBQyxDQUFDLENBQzdCLEVBQUUsTUFBTSxFQUFFLENBQUM7RUFDVixJQUFJRixLQUFLLElBQUksQ0FBQyxFQUFFLE9BQU8sQ0FBQ0QsSUFBSSxDQUFDO0VBQzdCO0VBQ0E7RUFDQTtFQUNBLE1BQU1JLFdBQVcsR0FBR0osSUFBSSxDQUFDSyxPQUFPLENBQUMsQ0FBQztFQUNsQyxNQUFNQyxPQUFPLEdBQUd2QixRQUFRLENBQUNxQixXQUFXLEVBQUVILEtBQUssRUFBRTtJQUMzQ0UsSUFBSSxFQUFFRCxPQUFPLEVBQUVDLElBQUksSUFBSSxLQUFLO0lBQzVCSSxJQUFJLEVBQUUsS0FBSztJQUNYQyxRQUFRLEVBQUU7RUFDWixDQUFDLENBQUM7RUFDRjtFQUNBO0VBQ0EsTUFBTUMsS0FBSyxHQUFHSCxPQUFPLENBQUNJLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQ0MsTUFBTSxDQUFDQyxJQUFJLElBQUlBLElBQUksQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQztFQUNqRTtFQUNBLE9BQU9KLEtBQUssQ0FBQ0ksTUFBTSxHQUFHLENBQUMsR0FBR0osS0FBSyxHQUFHLENBQUMsRUFBRSxDQUFDO0FBQ3hDOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPLFNBQVNLLGFBQWFBLENBQUM7RUFDNUJuQixLQUFLO0VBQ0xFLFNBQVM7RUFDVEM7QUFDSyxDQUFOLEVBQUVKLEtBQUssQ0FBQyxFQUFFZixLQUFLLENBQUNvQyxTQUFTLENBQUM7RUFDekIsTUFBTSxDQUFDQyxLQUFLLENBQUMsR0FBRy9CLFFBQVEsQ0FBQyxDQUFDO0VBQzFCLE1BQU07SUFBRWdDLE9BQU8sRUFBRUM7RUFBb0IsQ0FBQyxHQUFHckMsZUFBZSxDQUFDLENBQUM7RUFDMUQsTUFBTXNDLGFBQWEsR0FBR3JCLFVBQVUsSUFBSW9CLG1CQUFtQjs7RUFFdkQ7RUFDQSxTQUFTRSxVQUFVQSxDQUFDQyxNQUFNLEVBQUU1QyxLQUFLLEVBQUUsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLENBQUM7SUFDdkQsT0FDRTRDLE1BQU0sRUFDRkMsR0FBRyxDQUFDQyxDQUFDLElBQUlwQyxXQUFXLENBQUNvQyxDQUFDLEVBQUVQLEtBQUssRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRW5CLFNBQVMsQ0FBQyxDQUFDLENBQzFEMkIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUU7RUFFckI7O0VBRUE7RUFDQSxTQUFTQyxZQUFZQSxDQUFDSixRQUFNLEVBQUU1QyxLQUFLLEVBQUUsR0FBRyxTQUFTLENBQUMsRUFBRSxNQUFNLENBQUM7SUFDekQsT0FBT0csU0FBUyxDQUFDd0MsVUFBVSxDQUFDQyxRQUFNLENBQUMsQ0FBQztFQUN0Qzs7RUFFQTtFQUNBLFNBQVNLLFdBQVdBLENBQUNMLFFBQU0sRUFBRTVDLEtBQUssRUFBRSxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sQ0FBQztJQUN4RCxNQUFNdUIsSUFBSSxHQUFHeUIsWUFBWSxDQUFDSixRQUFNLENBQUM7SUFDakMsTUFBTU0sS0FBSyxHQUFHM0IsSUFBSSxDQUFDVSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUNDLE1BQU0sQ0FBQ2lCLENBQUMsSUFBSUEsQ0FBQyxDQUFDZixNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQ3pELElBQUljLEtBQUssQ0FBQ2QsTUFBTSxLQUFLLENBQUMsRUFBRSxPQUFPdkIsZ0JBQWdCO0lBQy9DLE9BQU91QyxJQUFJLENBQUNDLEdBQUcsQ0FBQyxHQUFHSCxLQUFLLENBQUNMLEdBQUcsQ0FBQ00sR0FBQyxJQUFJOUMsV0FBVyxDQUFDOEMsR0FBQyxDQUFDLENBQUMsRUFBRXRDLGdCQUFnQixDQUFDO0VBQ3RFOztFQUVBO0VBQ0EsU0FBU3lDLGFBQWFBLENBQUNWLFFBQU0sRUFBRTVDLEtBQUssRUFBRSxHQUFHLFNBQVMsQ0FBQyxFQUFFLE1BQU0sQ0FBQztJQUMxRCxPQUFPb0QsSUFBSSxDQUFDQyxHQUFHLENBQUNoRCxXQUFXLENBQUMyQyxZQUFZLENBQUNKLFFBQU0sQ0FBQyxDQUFDLEVBQUUvQixnQkFBZ0IsQ0FBQztFQUN0RTs7RUFFQTtFQUNBO0VBQ0EsTUFBTTBDLFNBQVMsR0FBR3JDLEtBQUssQ0FBQ3NDLE1BQU0sQ0FBQ1gsR0FBRyxDQUFDLENBQUNXLE1BQU0sRUFBRUMsUUFBUSxLQUFLO0lBQ3ZELElBQUlDLFdBQVcsR0FBR1QsV0FBVyxDQUFDTyxNQUFNLENBQUNaLE1BQU0sQ0FBQztJQUM1QyxLQUFLLE1BQU1lLEdBQUcsSUFBSXpDLEtBQUssQ0FBQzBDLElBQUksRUFBRTtNQUM1QkYsV0FBVyxHQUFHTixJQUFJLENBQUNDLEdBQUcsQ0FBQ0ssV0FBVyxFQUFFVCxXQUFXLENBQUNVLEdBQUcsQ0FBQ0YsUUFBUSxDQUFDLEVBQUViLE1BQU0sQ0FBQyxDQUFDO0lBQ3pFO0lBQ0EsT0FBT2MsV0FBVztFQUNwQixDQUFDLENBQUM7RUFFRixNQUFNRyxXQUFXLEdBQUczQyxLQUFLLENBQUNzQyxNQUFNLENBQUNYLEdBQUcsQ0FBQyxDQUFDVyxRQUFNLEVBQUVDLFVBQVEsS0FBSztJQUN6RCxJQUFJSyxRQUFRLEdBQUdSLGFBQWEsQ0FBQ0UsUUFBTSxDQUFDWixNQUFNLENBQUM7SUFDM0MsS0FBSyxNQUFNZSxLQUFHLElBQUl6QyxLQUFLLENBQUMwQyxJQUFJLEVBQUU7TUFDNUJFLFFBQVEsR0FBR1YsSUFBSSxDQUFDQyxHQUFHLENBQUNTLFFBQVEsRUFBRVIsYUFBYSxDQUFDSyxLQUFHLENBQUNGLFVBQVEsQ0FBQyxFQUFFYixNQUFNLENBQUMsQ0FBQztJQUNyRTtJQUNBLE9BQU9rQixRQUFRO0VBQ2pCLENBQUMsQ0FBQzs7RUFFRjtFQUNBO0VBQ0EsTUFBTUMsT0FBTyxHQUFHN0MsS0FBSyxDQUFDc0MsTUFBTSxDQUFDcEIsTUFBTTtFQUNuQyxNQUFNNEIsY0FBYyxHQUFHLENBQUMsR0FBR0QsT0FBTyxHQUFHLENBQUMsRUFBQztFQUN2QztFQUNBLE1BQU1FLGNBQWMsR0FBR2IsSUFBSSxDQUFDQyxHQUFHLENBQzdCWCxhQUFhLEdBQUdzQixjQUFjLEdBQUdwRCxhQUFhLEVBQzlDbUQsT0FBTyxHQUFHbEQsZ0JBQ1osQ0FBQzs7RUFFRDtFQUNBLE1BQU1xRCxRQUFRLEdBQUdYLFNBQVMsQ0FBQ1ksTUFBTSxDQUFDLENBQUNDLEdBQUcsRUFBRWpCLEdBQUMsS0FBS2lCLEdBQUcsR0FBR2pCLEdBQUMsRUFBRSxDQUFDLENBQUM7RUFDekQsTUFBTWtCLFVBQVUsR0FBR1IsV0FBVyxDQUFDTSxNQUFNLENBQUMsQ0FBQ0MsS0FBRyxFQUFFakIsR0FBQyxLQUFLaUIsS0FBRyxHQUFHakIsR0FBQyxFQUFFLENBQUMsQ0FBQzs7RUFFN0Q7RUFDQSxJQUFJbUIsYUFBYSxHQUFHLEtBQUs7RUFFekIsSUFBSUMsWUFBWSxFQUFFLE1BQU0sRUFBRTtFQUMxQixJQUFJRixVQUFVLElBQUlKLGNBQWMsRUFBRTtJQUNoQztJQUNBTSxZQUFZLEdBQUdWLFdBQVc7RUFDNUIsQ0FBQyxNQUFNLElBQUlLLFFBQVEsSUFBSUQsY0FBYyxFQUFFO0lBQ3JDO0lBQ0EsTUFBTU8sVUFBVSxHQUFHUCxjQUFjLEdBQUdDLFFBQVE7SUFDNUMsTUFBTU8sU0FBUyxHQUFHWixXQUFXLENBQUNoQixHQUFHLENBQUMsQ0FBQzZCLEtBQUssRUFBRUMsQ0FBQyxLQUFLRCxLQUFLLEdBQUduQixTQUFTLENBQUNvQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RFLE1BQU1DLGFBQWEsR0FBR0gsU0FBUyxDQUFDTixNQUFNLENBQUMsQ0FBQ0MsS0FBRyxFQUFFUyxDQUFDLEtBQUtULEtBQUcsR0FBR1MsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUU5RE4sWUFBWSxHQUFHaEIsU0FBUyxDQUFDVixHQUFHLENBQUMsQ0FBQ2lDLEdBQUcsRUFBRUgsR0FBQyxLQUFLO01BQ3ZDLElBQUlDLGFBQWEsS0FBSyxDQUFDLEVBQUUsT0FBT0UsR0FBRztNQUNuQyxNQUFNQyxLQUFLLEdBQUczQixJQUFJLENBQUM0QixLQUFLLENBQUVQLFNBQVMsQ0FBQ0UsR0FBQyxDQUFDLENBQUMsR0FBR0MsYUFBYSxHQUFJSixVQUFVLENBQUM7TUFDdEUsT0FBT00sR0FBRyxHQUFHQyxLQUFLO0lBQ3BCLENBQUMsQ0FBQztFQUNKLENBQUMsTUFBTTtJQUNMO0lBQ0E7SUFDQVQsYUFBYSxHQUFHLElBQUk7SUFDcEIsTUFBTVcsV0FBVyxHQUFHaEIsY0FBYyxHQUFHQyxRQUFRO0lBQzdDSyxZQUFZLEdBQUdoQixTQUFTLENBQUNWLEdBQUcsQ0FBQ00sR0FBQyxJQUM1QkMsSUFBSSxDQUFDQyxHQUFHLENBQUNELElBQUksQ0FBQzRCLEtBQUssQ0FBQzdCLEdBQUMsR0FBRzhCLFdBQVcsQ0FBQyxFQUFFcEUsZ0JBQWdCLENBQ3hELENBQUM7RUFDSDs7RUFFQTtFQUNBLFNBQVNxRSxvQkFBb0JBLENBQUEsQ0FBRSxFQUFFLE1BQU0sQ0FBQztJQUN0QyxJQUFJQyxRQUFRLEdBQUcsQ0FBQztJQUNoQjtJQUNBLEtBQUssSUFBSVIsR0FBQyxHQUFHLENBQUMsRUFBRUEsR0FBQyxHQUFHekQsS0FBSyxDQUFDc0MsTUFBTSxDQUFDcEIsTUFBTSxFQUFFdUMsR0FBQyxFQUFFLEVBQUU7TUFDNUMsTUFBTVMsT0FBTyxHQUFHekMsVUFBVSxDQUFDekIsS0FBSyxDQUFDc0MsTUFBTSxDQUFDbUIsR0FBQyxDQUFDLENBQUMsQ0FBQy9CLE1BQU0sQ0FBQztNQUNuRCxNQUFNZixPQUFPLEdBQUdQLFFBQVEsQ0FBQzhELE9BQU8sRUFBRWIsWUFBWSxDQUFDSSxHQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ2xEakQsSUFBSSxFQUFFNEM7TUFDUixDQUFDLENBQUM7TUFDRmEsUUFBUSxHQUFHL0IsSUFBSSxDQUFDQyxHQUFHLENBQUM4QixRQUFRLEVBQUV0RCxPQUFPLENBQUNPLE1BQU0sQ0FBQztJQUMvQztJQUNBO0lBQ0EsS0FBSyxNQUFNdUIsS0FBRyxJQUFJekMsS0FBSyxDQUFDMEMsSUFBSSxFQUFFO01BQzVCLEtBQUssSUFBSWUsR0FBQyxHQUFHLENBQUMsRUFBRUEsR0FBQyxHQUFHaEIsS0FBRyxDQUFDdkIsTUFBTSxFQUFFdUMsR0FBQyxFQUFFLEVBQUU7UUFDbkMsTUFBTVMsU0FBTyxHQUFHekMsVUFBVSxDQUFDZ0IsS0FBRyxDQUFDZ0IsR0FBQyxDQUFDLEVBQUUvQixNQUFNLENBQUM7UUFDMUMsTUFBTWYsU0FBTyxHQUFHUCxRQUFRLENBQUM4RCxTQUFPLEVBQUViLFlBQVksQ0FBQ0ksR0FBQyxDQUFDLENBQUMsRUFBRTtVQUNsRGpELElBQUksRUFBRTRDO1FBQ1IsQ0FBQyxDQUFDO1FBQ0ZhLFFBQVEsR0FBRy9CLElBQUksQ0FBQ0MsR0FBRyxDQUFDOEIsUUFBUSxFQUFFdEQsU0FBTyxDQUFDTyxNQUFNLENBQUM7TUFDL0M7SUFDRjtJQUNBLE9BQU8rQyxRQUFRO0VBQ2pCOztFQUVBO0VBQ0EsTUFBTUUsV0FBVyxHQUFHSCxvQkFBb0IsQ0FBQyxDQUFDO0VBQzFDLE1BQU1JLGlCQUFpQixHQUFHRCxXQUFXLEdBQUd2RSxhQUFhOztFQUVyRDtFQUNBO0VBQ0EsU0FBU3lFLGNBQWNBLENBQ3JCQyxLQUFLLEVBQUVDLEtBQUssQ0FBQztJQUFFN0MsTUFBTSxDQUFDLEVBQUU1QyxLQUFLLEVBQUU7RUFBQyxDQUFDLENBQUMsRUFDbEMwRixRQUFRLEVBQUUsT0FBTyxDQUNsQixFQUFFLE1BQU0sRUFBRSxDQUFDO0lBQ1Y7SUFDQSxNQUFNQyxTQUFTLEdBQUdILEtBQUssQ0FBQzNDLEdBQUcsQ0FBQyxDQUFDK0MsSUFBSSxFQUFFbkMsVUFBUSxLQUFLO01BQzlDLE1BQU1vQyxhQUFhLEdBQUdsRCxVQUFVLENBQUNpRCxJQUFJLENBQUNoRCxNQUFNLENBQUM7TUFDN0MsTUFBTXBCLEtBQUssR0FBRytDLFlBQVksQ0FBQ2QsVUFBUSxDQUFDLENBQUM7TUFDckMsT0FBT25DLFFBQVEsQ0FBQ3VFLGFBQWEsRUFBRXJFLEtBQUssRUFBRTtRQUFFRSxJQUFJLEVBQUU0QztNQUFjLENBQUMsQ0FBQztJQUNoRSxDQUFDLENBQUM7O0lBRUY7SUFDQSxNQUFNYSxVQUFRLEdBQUcvQixJQUFJLENBQUNDLEdBQUcsQ0FBQyxHQUFHc0MsU0FBUyxDQUFDOUMsR0FBRyxDQUFDYixLQUFLLElBQUlBLEtBQUssQ0FBQ0ksTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDOztJQUVyRTtJQUNBLE1BQU0wRCxlQUFlLEdBQUdILFNBQVMsQ0FBQzlDLEdBQUcsQ0FBQ2IsT0FBSyxJQUN6Q29CLElBQUksQ0FBQzRCLEtBQUssQ0FBQyxDQUFDRyxVQUFRLEdBQUduRCxPQUFLLENBQUNJLE1BQU0sSUFBSSxDQUFDLENBQzFDLENBQUM7O0lBRUQ7SUFDQSxNQUFNMkQsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUU7SUFDM0IsS0FBSyxJQUFJQyxPQUFPLEdBQUcsQ0FBQyxFQUFFQSxPQUFPLEdBQUdiLFVBQVEsRUFBRWEsT0FBTyxFQUFFLEVBQUU7TUFDbkQsSUFBSTdELElBQUksR0FBRyxHQUFHO01BQ2QsS0FBSyxJQUFJc0IsVUFBUSxHQUFHLENBQUMsRUFBRUEsVUFBUSxHQUFHK0IsS0FBSyxDQUFDcEQsTUFBTSxFQUFFcUIsVUFBUSxFQUFFLEVBQUU7UUFDMUQsTUFBTXpCLE9BQUssR0FBRzJELFNBQVMsQ0FBQ2xDLFVBQVEsQ0FBQyxDQUFDO1FBQ2xDLE1BQU13QyxNQUFNLEdBQUdILGVBQWUsQ0FBQ3JDLFVBQVEsQ0FBQyxDQUFDO1FBQ3pDLE1BQU15QyxjQUFjLEdBQUdGLE9BQU8sR0FBR0MsTUFBTTtRQUN2QyxNQUFNRSxRQUFRLEdBQ1pELGNBQWMsSUFBSSxDQUFDLElBQUlBLGNBQWMsR0FBR2xFLE9BQUssQ0FBQ0ksTUFBTSxHQUNoREosT0FBSyxDQUFDa0UsY0FBYyxDQUFDLENBQUMsR0FDdEIsRUFBRTtRQUNSLE1BQU0xRSxPQUFLLEdBQUcrQyxZQUFZLENBQUNkLFVBQVEsQ0FBQyxDQUFDO1FBQ3JDO1FBQ0EsTUFBTTJDLEtBQUssR0FBR1YsUUFBUSxHQUFHLFFBQVEsR0FBSXhFLEtBQUssQ0FBQ2tGLEtBQUssR0FBRzNDLFVBQVEsQ0FBQyxJQUFJLE1BQU87UUFFdkV0QixJQUFJLElBQ0YsR0FBRyxHQUFHeEIsVUFBVSxDQUFDd0YsUUFBUSxFQUFFOUYsV0FBVyxDQUFDOEYsUUFBUSxDQUFDLEVBQUUzRSxPQUFLLEVBQUU0RSxLQUFLLENBQUMsR0FBRyxJQUFJO01BQzFFO01BQ0FMLE1BQU0sQ0FBQ00sSUFBSSxDQUFDbEUsSUFBSSxDQUFDO0lBQ25CO0lBRUEsT0FBTzRELE1BQU07RUFDZjs7RUFFQTtFQUNBLFNBQVNPLGdCQUFnQkEsQ0FBQ0MsSUFBSSxFQUFFLEtBQUssR0FBRyxRQUFRLEdBQUcsUUFBUSxDQUFDLEVBQUUsTUFBTSxDQUFDO0lBQ25FLE1BQU0sQ0FBQ0MsSUFBSSxFQUFFQyxHQUFHLEVBQUVDLEtBQUssRUFBRUMsS0FBSyxDQUFDLEdBQUc7TUFDaENDLEdBQUcsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztNQUN6QkMsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO01BQzVCQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQzdCLENBQUMsQ0FBQ1AsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUM7SUFFM0MsSUFBSXBFLE1BQUksR0FBR3FFLElBQUk7SUFDZmpDLFlBQVksQ0FBQ3dDLE9BQU8sQ0FBQyxDQUFDdkYsT0FBSyxFQUFFaUMsVUFBUSxLQUFLO01BQ3hDdEIsTUFBSSxJQUFJc0UsR0FBRyxDQUFDTyxNQUFNLENBQUN4RixPQUFLLEdBQUcsQ0FBQyxDQUFDO01BQzdCVyxNQUFJLElBQUlzQixVQUFRLEdBQUdjLFlBQVksQ0FBQ25DLE1BQU0sR0FBRyxDQUFDLEdBQUdzRSxLQUFLLEdBQUdDLEtBQUs7SUFDNUQsQ0FBQyxDQUFDO0lBQ0YsT0FBT3hFLE1BQUk7RUFDYjs7RUFFQTtFQUNBLFNBQVM4RSxvQkFBb0JBLENBQUEsQ0FBRSxFQUFFLE1BQU0sQ0FBQztJQUN0QyxNQUFNakYsT0FBSyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUU7SUFDMUIsTUFBTWtGLE9BQU8sR0FBR2hHLEtBQUssQ0FBQ3NDLE1BQU0sQ0FBQ1gsR0FBRyxDQUFDc0UsQ0FBQyxJQUFJbkUsWUFBWSxDQUFDbUUsQ0FBQyxDQUFDdkUsTUFBTSxDQUFDLENBQUM7SUFDN0QsTUFBTXdFLGNBQWMsR0FBR2hFLElBQUksQ0FBQzBCLEdBQUcsQ0FBQ3BDLGFBQWEsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDO0lBQ3RELE1BQU0yRSxTQUFTLEdBQUcsR0FBRyxDQUFDTCxNQUFNLENBQUNJLGNBQWMsQ0FBQztJQUM1QztJQUNBLE1BQU1FLFVBQVUsR0FBRyxJQUFJO0lBRXZCcEcsS0FBSyxDQUFDMEMsSUFBSSxDQUFDbUQsT0FBTyxDQUFDLENBQUNwRCxLQUFHLEVBQUU0RCxRQUFRLEtBQUs7TUFDcEMsSUFBSUEsUUFBUSxHQUFHLENBQUMsRUFBRTtRQUNoQnZGLE9BQUssQ0FBQ3FFLElBQUksQ0FBQ2dCLFNBQVMsQ0FBQztNQUN2QjtNQUVBMUQsS0FBRyxDQUFDb0QsT0FBTyxDQUFDLENBQUNuQixNQUFJLEVBQUVuQyxVQUFRLEtBQUs7UUFDOUIsTUFBTStELEtBQUssR0FBR04sT0FBTyxDQUFDekQsVUFBUSxDQUFDLElBQUksVUFBVUEsVUFBUSxHQUFHLENBQUMsRUFBRTtRQUMzRDtRQUNBLE1BQU1nRSxRQUFRLEdBQUc5RSxVQUFVLENBQUNpRCxNQUFJLENBQUNoRCxNQUFNLENBQUMsQ0FBQ2hCLE9BQU8sQ0FBQyxDQUFDO1FBQ2xELE1BQU04RixLQUFLLEdBQUdELFFBQVEsQ0FBQ0UsT0FBTyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQ0EsT0FBTyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQzdGLElBQUksQ0FBQyxDQUFDOztRQUV2RTtRQUNBLE1BQU04RixjQUFjLEdBQUdsRixhQUFhLEdBQUdyQyxXQUFXLENBQUNtSCxLQUFLLENBQUMsR0FBRyxDQUFDO1FBQzdELE1BQU1LLG1CQUFtQixHQUFHbkYsYUFBYSxHQUFHNEUsVUFBVSxDQUFDbEYsTUFBTSxHQUFHLENBQUM7O1FBRWpFO1FBQ0E7UUFDQSxNQUFNMEYsY0FBYyxHQUFHeEcsUUFBUSxDQUFDb0csS0FBSyxFQUFFdEUsSUFBSSxDQUFDQyxHQUFHLENBQUN1RSxjQUFjLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDcEUsTUFBTUcsU0FBUyxHQUFHRCxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRTtRQUV6QyxJQUFJRSxZQUFZLEVBQUUsTUFBTSxFQUFFO1FBQzFCLElBQ0VGLGNBQWMsQ0FBQzFGLE1BQU0sSUFBSSxDQUFDLElBQzFCeUYsbUJBQW1CLElBQUlELGNBQWMsRUFDckM7VUFDQUksWUFBWSxHQUFHRixjQUFjO1FBQy9CLENBQUMsTUFBTTtVQUNMO1VBQ0EsTUFBTUcsYUFBYSxHQUFHSCxjQUFjLENBQ2pDSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQ1JyRixHQUFHLENBQUNzRixDQUFDLElBQUlBLENBQUMsQ0FBQ3JHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FDbEJpQixJQUFJLENBQUMsR0FBRyxDQUFDO1VBQ1osTUFBTXFGLFNBQVMsR0FBRzlHLFFBQVEsQ0FBQzJHLGFBQWEsRUFBRUosbUJBQW1CLENBQUM7VUFDOURHLFlBQVksR0FBRyxDQUFDRCxTQUFTLEVBQUUsR0FBR0ssU0FBUyxDQUFDO1FBQzFDOztRQUVBO1FBQ0FwRyxPQUFLLENBQUNxRSxJQUFJLENBQ1IsR0FBR3RGLGVBQWUsR0FBR3lHLEtBQUssSUFBSXhHLGFBQWEsSUFBSWdILFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQ3RFLENBQUM7O1FBRUQ7UUFDQSxLQUFLLElBQUlyRCxHQUFDLEdBQUcsQ0FBQyxFQUFFQSxHQUFDLEdBQUdxRCxZQUFZLENBQUM1RixNQUFNLEVBQUV1QyxHQUFDLEVBQUUsRUFBRTtVQUM1QyxNQUFNeEMsTUFBSSxHQUFHNkYsWUFBWSxDQUFDckQsR0FBQyxDQUFDLENBQUM7VUFDN0IsSUFBSSxDQUFDeEMsTUFBSSxDQUFDTCxJQUFJLENBQUMsQ0FBQyxFQUFFO1VBQ2xCRSxPQUFLLENBQUNxRSxJQUFJLENBQUMsR0FBR2lCLFVBQVUsR0FBR25GLE1BQUksRUFBRSxDQUFDO1FBQ3BDO01BQ0YsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDO0lBRUYsT0FBT0gsT0FBSyxDQUFDZSxJQUFJLENBQUMsSUFBSSxDQUFDO0VBQ3pCOztFQUVBO0VBQ0EsSUFBSXVDLGlCQUFpQixFQUFFO0lBQ3JCLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQzJCLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQztFQUM5Qzs7RUFFQTtFQUNBLE1BQU1vQixVQUFVLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRTtFQUMvQkEsVUFBVSxDQUFDaEMsSUFBSSxDQUFDQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUN4QytCLFVBQVUsQ0FBQ2hDLElBQUksQ0FBQyxHQUFHZCxjQUFjLENBQUNyRSxLQUFLLENBQUNzQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7RUFDdEQ2RSxVQUFVLENBQUNoQyxJQUFJLENBQUNDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDO0VBQzNDcEYsS0FBSyxDQUFDMEMsSUFBSSxDQUFDbUQsT0FBTyxDQUFDLENBQUNwRCxLQUFHLEVBQUU0RCxVQUFRLEtBQUs7SUFDcENjLFVBQVUsQ0FBQ2hDLElBQUksQ0FBQyxHQUFHZCxjQUFjLENBQUM1QixLQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDOUMsSUFBSTRELFVBQVEsR0FBR3JHLEtBQUssQ0FBQzBDLElBQUksQ0FBQ3hCLE1BQU0sR0FBRyxDQUFDLEVBQUU7TUFDcENpRyxVQUFVLENBQUNoQyxJQUFJLENBQUNDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdDO0VBQ0YsQ0FBQyxDQUFDO0VBQ0YrQixVQUFVLENBQUNoQyxJQUFJLENBQUNDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDOztFQUUzQztFQUNBO0VBQ0E7RUFDQSxNQUFNZ0MsWUFBWSxHQUFHbEYsSUFBSSxDQUFDQyxHQUFHLENBQzNCLEdBQUdnRixVQUFVLENBQUN4RixHQUFHLENBQUNWLE1BQUksSUFBSTlCLFdBQVcsQ0FBQ0YsU0FBUyxDQUFDZ0MsTUFBSSxDQUFDLENBQUMsQ0FDeEQsQ0FBQzs7RUFFRDtFQUNBO0VBQ0EsSUFBSW1HLFlBQVksR0FBRzVGLGFBQWEsR0FBRzlCLGFBQWEsRUFBRTtJQUNoRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUNxRyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUM7RUFDOUM7O0VBRUE7RUFDQSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUNvQixVQUFVLENBQUN0RixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUM7QUFDN0MiLCJpZ25vcmVMaXN0IjpbXX0=