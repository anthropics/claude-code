import { c as _c } from "react/compiler-runtime";
import { diffWordsWithSpace, type StructuredPatchHunk } from 'diff';
import * as React from 'react';
import { useMemo } from 'react';
import type { ThemeName } from 'src/utils/theme.js';
import { stringWidth } from '../../ink/stringWidth.js';
import { Box, NoSelect, Text, useTheme, wrapText } from '../../ink.js';

/*
 * StructuredDiffFallback Component: Word-Level Diff Highlighting Example
 *
 * This component shows diff changes with word-level highlighting. Here's a walkthrough:
 *
 * Example:
 * ```
 * // Original code
 * function oldName(param) {
 *   return param.oldProperty;
 * }
 *
 * // Changed code
 * function newName(param) {
 *   return param.newProperty;
 * }
 * ```
 *
 * Processing flow:
 * 1. Component receives a patch with lines including '+' and '-' prefixes
 * 2. Lines are transformed into objects with type (add/remove/nochange)
 * 3. Related add/remove lines are paired (e.g., oldName with newName)
 * 4. Word-level diffing identifies specific changed parts:
 *    [
 *      { value: 'function ', added: undefined, removed: undefined },  // Common
 *      { value: 'oldName', removed: true },                           // Removed
 *      { value: 'newName', added: true },                             // Added
 *      { value: '(param) {', added: undefined, removed: undefined }   // Common
 *    ]
 * 5. Renders with enhanced highlighting:
 *    - Common parts are shown normally
 *    - Removed words get a darker red background
 *    - Added words get a darker green background
 *
 * This produces a visually clear diff where users can see exactly which words
 * changed rather than just which lines were modified.
 */

// Define DiffLine interface to be used throughout the file
interface DiffLine {
  code: string;
  type: 'add' | 'remove' | 'nochange';
  i: number;
  originalCode: string;
  wordDiff?: boolean; // Flag for word-level diffing
  matchedLine?: DiffLine;
}

// Line object type for internal functions
export interface LineObject {
  code: string;
  i: number;
  type: 'add' | 'remove' | 'nochange';
  originalCode: string;
  wordDiff?: boolean;
  matchedLine?: LineObject;
}

// Type for word-level diff parts
interface DiffPart {
  added?: boolean;
  removed?: boolean;
  value: string;
}
type Props = {
  patch: StructuredPatchHunk;
  dim: boolean;
  width: number;
};

// Threshold for when we show a full-line diff instead of word-level diffing
const CHANGE_THRESHOLD = 0.4;
export function StructuredDiffFallback(t0) {
  const $ = _c(10);
  const {
    patch,
    dim,
    width
  } = t0;
  const [theme] = useTheme();
  let t1;
  if ($[0] !== dim || $[1] !== patch.lines || $[2] !== patch.oldStart || $[3] !== theme || $[4] !== width) {
    t1 = formatDiff(patch.lines, patch.oldStart, width, dim, theme);
    $[0] = dim;
    $[1] = patch.lines;
    $[2] = patch.oldStart;
    $[3] = theme;
    $[4] = width;
    $[5] = t1;
  } else {
    t1 = $[5];
  }
  const diff = t1;
  let t2;
  if ($[6] !== diff) {
    t2 = diff.map(_temp);
    $[6] = diff;
    $[7] = t2;
  } else {
    t2 = $[7];
  }
  let t3;
  if ($[8] !== t2) {
    t3 = <Box flexDirection="column" flexGrow={1}>{t2}</Box>;
    $[8] = t2;
    $[9] = t3;
  } else {
    t3 = $[9];
  }
  return t3;
}

// Transform lines to line objects with type information
function _temp(node, i) {
  return <Box key={i}>{node}</Box>;
}
export function transformLinesToObjects(lines: string[]): LineObject[] {
  return lines.map(code => {
    if (code.startsWith('+')) {
      return {
        code: code.slice(1),
        i: 0,
        type: 'add',
        originalCode: code.slice(1)
      };
    }
    if (code.startsWith('-')) {
      return {
        code: code.slice(1),
        i: 0,
        type: 'remove',
        originalCode: code.slice(1)
      };
    }
    return {
      code: code.slice(1),
      i: 0,
      type: 'nochange',
      originalCode: code.slice(1)
    };
  });
}

// Group adjacent add/remove lines for word-level diffing
export function processAdjacentLines(lineObjects: LineObject[]): LineObject[] {
  const processedLines: LineObject[] = [];
  let i = 0;
  while (i < lineObjects.length) {
    const current = lineObjects[i];
    if (!current) {
      i++;
      continue;
    }

    // Find a sequence of remove followed by add (possible word-level diff candidates)
    if (current.type === 'remove') {
      const removeLines: LineObject[] = [current];
      let j = i + 1;

      // Collect consecutive remove lines
      while (j < lineObjects.length && lineObjects[j]?.type === 'remove') {
        const line = lineObjects[j];
        if (line) {
          removeLines.push(line);
        }
        j++;
      }

      // Check if there are add lines following the remove lines
      const addLines: LineObject[] = [];
      while (j < lineObjects.length && lineObjects[j]?.type === 'add') {
        const line = lineObjects[j];
        if (line) {
          addLines.push(line);
        }
        j++;
      }

      // If we have both remove and add lines, perform word-level diffing
      if (removeLines.length > 0 && addLines.length > 0) {
        // For word diffing, we'll compare each pair of lines or the closest available match
        const pairCount = Math.min(removeLines.length, addLines.length);

        // Add paired lines with word diff info
        for (let k = 0; k < pairCount; k++) {
          const removeLine = removeLines[k];
          const addLine = addLines[k];
          if (removeLine && addLine) {
            removeLine.wordDiff = true;
            addLine.wordDiff = true;

            // Store the matched pair for later word diffing
            removeLine.matchedLine = addLine;
            addLine.matchedLine = removeLine;
          }
        }

        // Add all remove lines (both paired and unpaired)
        processedLines.push(...removeLines.filter(Boolean));

        // Then add all add lines (both paired and unpaired)
        processedLines.push(...addLines.filter(Boolean));
        i = j; // Skip all the lines we've processed
      } else {
        // No matching add lines, just add the current remove line
        processedLines.push(current);
        i++;
      }
    } else {
      // Not a remove line, just add it
      processedLines.push(current);
      i++;
    }
  }
  return processedLines;
}

// Calculate word-level diffs between two text strings
export function calculateWordDiffs(oldText: string, newText: string): DiffPart[] {
  // Use diffWordsWithSpace instead of diffWords to preserve whitespace
  // This ensures spaces between tokens like > and { are preserved
  const result = diffWordsWithSpace(oldText, newText, {
    ignoreCase: false
  });
  return result;
}

// Process word-level diffs with manual wrapping support
function generateWordDiffElements(item: DiffLine, width: number, maxWidth: number, dim: boolean, overrideTheme?: ThemeName): React.ReactNode[] | null {
  const {
    type,
    i,
    wordDiff,
    matchedLine,
    originalCode
  } = item;
  if (!wordDiff || !matchedLine) {
    return null; // This function only handles word-level diff rendering
  }
  const removedLineText = type === 'remove' ? originalCode : matchedLine.originalCode;
  const addedLineText = type === 'remove' ? matchedLine.originalCode : originalCode;
  const wordDiffs = calculateWordDiffs(removedLineText, addedLineText);

  // Check if we should use word-level diffing
  const totalLength = removedLineText.length + addedLineText.length;
  const changedLength = wordDiffs.filter(part => part.added || part.removed).reduce((sum, part) => sum + part.value.length, 0);
  const changeRatio = changedLength / totalLength;
  if (changeRatio > CHANGE_THRESHOLD || dim) {
    return null; // Fall back to standard rendering for major changes
  }

  // Calculate available width for content
  const diffPrefix = type === 'add' ? '+' : '-';
  const diffPrefixWidth = diffPrefix.length;
  const availableContentWidth = Math.max(1, width - maxWidth - 1 - diffPrefixWidth);

  // Manually wrap the word diff parts with better space efficiency
  const wrappedLines: {
    content: React.ReactNode[];
    contentWidth: number;
  }[] = [];
  let currentLine: React.ReactNode[] = [];
  let currentLineWidth = 0;
  wordDiffs.forEach((part, partIndex) => {
    // Determine if this part should be shown for this line type
    let shouldShow = false;
    let partBgColor: 'diffAddedWord' | 'diffRemovedWord' | undefined;
    if (type === 'add') {
      if (part.added) {
        shouldShow = true;
        partBgColor = 'diffAddedWord';
      } else if (!part.removed) {
        shouldShow = true;
      }
    } else if (type === 'remove') {
      if (part.removed) {
        shouldShow = true;
        partBgColor = 'diffRemovedWord';
      } else if (!part.added) {
        shouldShow = true;
      }
    }
    if (!shouldShow) return;

    // Use wrapText to wrap this individual part if it's long
    const partWrapped = wrapText(part.value, availableContentWidth, 'wrap');
    const partLines = partWrapped.split('\n');
    partLines.forEach((partLine, lineIdx) => {
      if (!partLine) return;

      // Check if we need to start a new line
      if (lineIdx > 0 || currentLineWidth + stringWidth(partLine) > availableContentWidth) {
        if (currentLine.length > 0) {
          wrappedLines.push({
            content: [...currentLine],
            contentWidth: currentLineWidth
          });
          currentLine = [];
          currentLineWidth = 0;
        }
      }
      currentLine.push(<Text key={`part-${partIndex}-${lineIdx}`} backgroundColor={partBgColor}>
          {partLine}
        </Text>);
      currentLineWidth += stringWidth(partLine);
    });
  });
  if (currentLine.length > 0) {
    wrappedLines.push({
      content: currentLine,
      contentWidth: currentLineWidth
    });
  }

  // Render each wrapped line as a separate Text element
  return wrappedLines.map(({
    content,
    contentWidth
  }, lineIndex) => {
    const key = `${type}-${i}-${lineIndex}`;
    const lineBgColor = type === 'add' ? dim ? 'diffAddedDimmed' : 'diffAdded' : dim ? 'diffRemovedDimmed' : 'diffRemoved';
    const lineNum = lineIndex === 0 ? i : undefined;
    const lineNumStr = (lineNum !== undefined ? lineNum.toString().padStart(maxWidth) : ' '.repeat(maxWidth)) + ' ';
    // Calculate padding to fill the entire terminal width
    const usedWidth = lineNumStr.length + diffPrefixWidth + contentWidth;
    const padding = Math.max(0, width - usedWidth);
    return <Box key={key} flexDirection="row">
        <NoSelect fromLeftEdge>
          <Text color={overrideTheme ? 'text' : undefined} backgroundColor={lineBgColor} dimColor={dim}>
            {lineNumStr}
            {diffPrefix}
          </Text>
        </NoSelect>
        <Text color={overrideTheme ? 'text' : undefined} backgroundColor={lineBgColor} dimColor={dim}>
          {content}
          {' '.repeat(padding)}
        </Text>
      </Box>;
  });
}
function formatDiff(lines: string[], startingLineNumber: number, width: number, dim: boolean, overrideTheme?: ThemeName): React.ReactNode[] {
  // Ensure width is at least 1 to prevent rendering issues with very narrow terminals
  const safeWidth = Math.max(1, Math.floor(width));

  // Step 1: Transform lines to line objects with type information
  const lineObjects = transformLinesToObjects(lines);

  // Step 2: Group adjacent add/remove lines for word-level diffing
  const processedLines = processAdjacentLines(lineObjects);

  // Step 3: Number the diff lines
  const ls = numberDiffLines(processedLines, startingLineNumber);

  // Find max line number width for alignment
  const maxLineNumber = Math.max(...ls.map(({
    i
  }) => i), 0);
  const maxWidth = Math.max(maxLineNumber.toString().length + 1, 0);

  // Step 4: Render formatting
  return ls.flatMap((item): React.ReactNode[] => {
    const {
      type,
      code,
      i,
      wordDiff,
      matchedLine
    } = item;

    // Handle word-level diffing for add/remove pairs
    if (wordDiff && matchedLine) {
      const wordDiffElements = generateWordDiffElements(item, safeWidth, maxWidth, dim, overrideTheme);

      // word-diff might refuse (e.g. due to lines being substantially different) in which
      // case we'll fall through to normal renderin gbelow
      if (wordDiffElements !== null) {
        return wordDiffElements;
      }
    }

    // Standard rendering for lines without word diffing or as fallback
    // Calculate available width accounting for line number + space + diff prefix
    const diffPrefixWidth = 2; // "  " for unchanged, "+ " or "- " for changes
    const availableContentWidth = Math.max(1, safeWidth - maxWidth - 1 - diffPrefixWidth); // -1 for space after line number
    const wrappedText = wrapText(code, availableContentWidth, 'wrap');
    const wrappedLines = wrappedText.split('\n');
    return wrappedLines.map((line, lineIndex) => {
      const key = `${type}-${i}-${lineIndex}`;
      const lineNum = lineIndex === 0 ? i : undefined;
      const lineNumStr = (lineNum !== undefined ? lineNum.toString().padStart(maxWidth) : ' '.repeat(maxWidth)) + ' ';
      const sigil = type === 'add' ? '+' : type === 'remove' ? '-' : ' ';
      // Calculate padding to fill the entire terminal width
      const contentWidth = lineNumStr.length + 1 + stringWidth(line); // lineNum + sigil + code
      const padding = Math.max(0, safeWidth - contentWidth);
      const bgColor = type === 'add' ? dim ? 'diffAddedDimmed' : 'diffAdded' : type === 'remove' ? dim ? 'diffRemovedDimmed' : 'diffRemoved' : undefined;

      // Gutter (line number + sigil) is wrapped in <NoSelect> so fullscreen
      // text selection yields clean code. bgColor carries across both boxes
      // so the visual continuity (solid red/green bar) is unchanged.
      return <Box key={key} flexDirection="row">
          <NoSelect fromLeftEdge>
            <Text color={overrideTheme ? 'text' : undefined} backgroundColor={bgColor} dimColor={dim || type === 'nochange'}>
              {lineNumStr}
              {sigil}
            </Text>
          </NoSelect>
          <Text color={overrideTheme ? 'text' : undefined} backgroundColor={bgColor} dimColor={dim}>
            {line}
            {' '.repeat(padding)}
          </Text>
        </Box>;
    });
  });
}
export function numberDiffLines(diff: LineObject[], startLine: number): DiffLine[] {
  let i = startLine;
  const result: DiffLine[] = [];
  const queue = [...diff];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const {
      code,
      type,
      originalCode,
      wordDiff,
      matchedLine
    } = current;
    const line = {
      code,
      type,
      i,
      originalCode,
      wordDiff,
      matchedLine
    };

    // Update counters based on change type
    switch (type) {
      case 'nochange':
        i++;
        result.push(line);
        break;
      case 'add':
        i++;
        result.push(line);
        break;
      case 'remove':
        {
          result.push(line);
          let numRemoved = 0;
          while (queue[0]?.type === 'remove') {
            i++;
            const current = queue.shift()!;
            const {
              code,
              type,
              originalCode,
              wordDiff,
              matchedLine
            } = current;
            const line = {
              code,
              type,
              i,
              originalCode,
              wordDiff,
              matchedLine
            };
            result.push(line);
            numRemoved++;
          }
          i -= numRemoved;
          break;
        }
    }
  }
  return result;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJkaWZmV29yZHNXaXRoU3BhY2UiLCJTdHJ1Y3R1cmVkUGF0Y2hIdW5rIiwiUmVhY3QiLCJ1c2VNZW1vIiwiVGhlbWVOYW1lIiwic3RyaW5nV2lkdGgiLCJCb3giLCJOb1NlbGVjdCIsIlRleHQiLCJ1c2VUaGVtZSIsIndyYXBUZXh0IiwiRGlmZkxpbmUiLCJjb2RlIiwidHlwZSIsImkiLCJvcmlnaW5hbENvZGUiLCJ3b3JkRGlmZiIsIm1hdGNoZWRMaW5lIiwiTGluZU9iamVjdCIsIkRpZmZQYXJ0IiwiYWRkZWQiLCJyZW1vdmVkIiwidmFsdWUiLCJQcm9wcyIsInBhdGNoIiwiZGltIiwid2lkdGgiLCJDSEFOR0VfVEhSRVNIT0xEIiwiU3RydWN0dXJlZERpZmZGYWxsYmFjayIsInQwIiwiJCIsIl9jIiwidGhlbWUiLCJ0MSIsImxpbmVzIiwib2xkU3RhcnQiLCJmb3JtYXREaWZmIiwiZGlmZiIsInQyIiwibWFwIiwiX3RlbXAiLCJ0MyIsIm5vZGUiLCJ0cmFuc2Zvcm1MaW5lc1RvT2JqZWN0cyIsInN0YXJ0c1dpdGgiLCJzbGljZSIsInByb2Nlc3NBZGphY2VudExpbmVzIiwibGluZU9iamVjdHMiLCJwcm9jZXNzZWRMaW5lcyIsImxlbmd0aCIsImN1cnJlbnQiLCJyZW1vdmVMaW5lcyIsImoiLCJsaW5lIiwicHVzaCIsImFkZExpbmVzIiwicGFpckNvdW50IiwiTWF0aCIsIm1pbiIsImsiLCJyZW1vdmVMaW5lIiwiYWRkTGluZSIsImZpbHRlciIsIkJvb2xlYW4iLCJjYWxjdWxhdGVXb3JkRGlmZnMiLCJvbGRUZXh0IiwibmV3VGV4dCIsInJlc3VsdCIsImlnbm9yZUNhc2UiLCJnZW5lcmF0ZVdvcmREaWZmRWxlbWVudHMiLCJpdGVtIiwibWF4V2lkdGgiLCJvdmVycmlkZVRoZW1lIiwiUmVhY3ROb2RlIiwicmVtb3ZlZExpbmVUZXh0IiwiYWRkZWRMaW5lVGV4dCIsIndvcmREaWZmcyIsInRvdGFsTGVuZ3RoIiwiY2hhbmdlZExlbmd0aCIsInBhcnQiLCJyZWR1Y2UiLCJzdW0iLCJjaGFuZ2VSYXRpbyIsImRpZmZQcmVmaXgiLCJkaWZmUHJlZml4V2lkdGgiLCJhdmFpbGFibGVDb250ZW50V2lkdGgiLCJtYXgiLCJ3cmFwcGVkTGluZXMiLCJjb250ZW50IiwiY29udGVudFdpZHRoIiwiY3VycmVudExpbmUiLCJjdXJyZW50TGluZVdpZHRoIiwiZm9yRWFjaCIsInBhcnRJbmRleCIsInNob3VsZFNob3ciLCJwYXJ0QmdDb2xvciIsInBhcnRXcmFwcGVkIiwicGFydExpbmVzIiwic3BsaXQiLCJwYXJ0TGluZSIsImxpbmVJZHgiLCJsaW5lSW5kZXgiLCJrZXkiLCJsaW5lQmdDb2xvciIsImxpbmVOdW0iLCJ1bmRlZmluZWQiLCJsaW5lTnVtU3RyIiwidG9TdHJpbmciLCJwYWRTdGFydCIsInJlcGVhdCIsInVzZWRXaWR0aCIsInBhZGRpbmciLCJzdGFydGluZ0xpbmVOdW1iZXIiLCJzYWZlV2lkdGgiLCJmbG9vciIsImxzIiwibnVtYmVyRGlmZkxpbmVzIiwibWF4TGluZU51bWJlciIsImZsYXRNYXAiLCJ3b3JkRGlmZkVsZW1lbnRzIiwid3JhcHBlZFRleHQiLCJzaWdpbCIsImJnQ29sb3IiLCJzdGFydExpbmUiLCJxdWV1ZSIsInNoaWZ0IiwibnVtUmVtb3ZlZCJdLCJzb3VyY2VzIjpbIkZhbGxiYWNrLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkaWZmV29yZHNXaXRoU3BhY2UsIHR5cGUgU3RydWN0dXJlZFBhdGNoSHVuayB9IGZyb20gJ2RpZmYnXG5pbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7IHVzZU1lbW8gfSBmcm9tICdyZWFjdCdcbmltcG9ydCB0eXBlIHsgVGhlbWVOYW1lIH0gZnJvbSAnc3JjL3V0aWxzL3RoZW1lLmpzJ1xuaW1wb3J0IHsgc3RyaW5nV2lkdGggfSBmcm9tICcuLi8uLi9pbmsvc3RyaW5nV2lkdGguanMnXG5pbXBvcnQgeyBCb3gsIE5vU2VsZWN0LCBUZXh0LCB1c2VUaGVtZSwgd3JhcFRleHQgfSBmcm9tICcuLi8uLi9pbmsuanMnXG5cbi8qXG4gKiBTdHJ1Y3R1cmVkRGlmZkZhbGxiYWNrIENvbXBvbmVudDogV29yZC1MZXZlbCBEaWZmIEhpZ2hsaWdodGluZyBFeGFtcGxlXG4gKlxuICogVGhpcyBjb21wb25lbnQgc2hvd3MgZGlmZiBjaGFuZ2VzIHdpdGggd29yZC1sZXZlbCBoaWdobGlnaHRpbmcuIEhlcmUncyBhIHdhbGt0aHJvdWdoOlxuICpcbiAqIEV4YW1wbGU6XG4gKiBgYGBcbiAqIC8vIE9yaWdpbmFsIGNvZGVcbiAqIGZ1bmN0aW9uIG9sZE5hbWUocGFyYW0pIHtcbiAqICAgcmV0dXJuIHBhcmFtLm9sZFByb3BlcnR5O1xuICogfVxuICpcbiAqIC8vIENoYW5nZWQgY29kZVxuICogZnVuY3Rpb24gbmV3TmFtZShwYXJhbSkge1xuICogICByZXR1cm4gcGFyYW0ubmV3UHJvcGVydHk7XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBQcm9jZXNzaW5nIGZsb3c6XG4gKiAxLiBDb21wb25lbnQgcmVjZWl2ZXMgYSBwYXRjaCB3aXRoIGxpbmVzIGluY2x1ZGluZyAnKycgYW5kICctJyBwcmVmaXhlc1xuICogMi4gTGluZXMgYXJlIHRyYW5zZm9ybWVkIGludG8gb2JqZWN0cyB3aXRoIHR5cGUgKGFkZC9yZW1vdmUvbm9jaGFuZ2UpXG4gKiAzLiBSZWxhdGVkIGFkZC9yZW1vdmUgbGluZXMgYXJlIHBhaXJlZCAoZS5nLiwgb2xkTmFtZSB3aXRoIG5ld05hbWUpXG4gKiA0LiBXb3JkLWxldmVsIGRpZmZpbmcgaWRlbnRpZmllcyBzcGVjaWZpYyBjaGFuZ2VkIHBhcnRzOlxuICogICAgW1xuICogICAgICB7IHZhbHVlOiAnZnVuY3Rpb24gJywgYWRkZWQ6IHVuZGVmaW5lZCwgcmVtb3ZlZDogdW5kZWZpbmVkIH0sICAvLyBDb21tb25cbiAqICAgICAgeyB2YWx1ZTogJ29sZE5hbWUnLCByZW1vdmVkOiB0cnVlIH0sICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmVtb3ZlZFxuICogICAgICB7IHZhbHVlOiAnbmV3TmFtZScsIGFkZGVkOiB0cnVlIH0sICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBZGRlZFxuICogICAgICB7IHZhbHVlOiAnKHBhcmFtKSB7JywgYWRkZWQ6IHVuZGVmaW5lZCwgcmVtb3ZlZDogdW5kZWZpbmVkIH0gICAvLyBDb21tb25cbiAqICAgIF1cbiAqIDUuIFJlbmRlcnMgd2l0aCBlbmhhbmNlZCBoaWdobGlnaHRpbmc6XG4gKiAgICAtIENvbW1vbiBwYXJ0cyBhcmUgc2hvd24gbm9ybWFsbHlcbiAqICAgIC0gUmVtb3ZlZCB3b3JkcyBnZXQgYSBkYXJrZXIgcmVkIGJhY2tncm91bmRcbiAqICAgIC0gQWRkZWQgd29yZHMgZ2V0IGEgZGFya2VyIGdyZWVuIGJhY2tncm91bmRcbiAqXG4gKiBUaGlzIHByb2R1Y2VzIGEgdmlzdWFsbHkgY2xlYXIgZGlmZiB3aGVyZSB1c2VycyBjYW4gc2VlIGV4YWN0bHkgd2hpY2ggd29yZHNcbiAqIGNoYW5nZWQgcmF0aGVyIHRoYW4ganVzdCB3aGljaCBsaW5lcyB3ZXJlIG1vZGlmaWVkLlxuICovXG5cbi8vIERlZmluZSBEaWZmTGluZSBpbnRlcmZhY2UgdG8gYmUgdXNlZCB0aHJvdWdob3V0IHRoZSBmaWxlXG5pbnRlcmZhY2UgRGlmZkxpbmUge1xuICBjb2RlOiBzdHJpbmdcbiAgdHlwZTogJ2FkZCcgfCAncmVtb3ZlJyB8ICdub2NoYW5nZSdcbiAgaTogbnVtYmVyXG4gIG9yaWdpbmFsQ29kZTogc3RyaW5nXG4gIHdvcmREaWZmPzogYm9vbGVhbiAvLyBGbGFnIGZvciB3b3JkLWxldmVsIGRpZmZpbmdcbiAgbWF0Y2hlZExpbmU/OiBEaWZmTGluZVxufVxuXG4vLyBMaW5lIG9iamVjdCB0eXBlIGZvciBpbnRlcm5hbCBmdW5jdGlvbnNcbmV4cG9ydCBpbnRlcmZhY2UgTGluZU9iamVjdCB7XG4gIGNvZGU6IHN0cmluZ1xuICBpOiBudW1iZXJcbiAgdHlwZTogJ2FkZCcgfCAncmVtb3ZlJyB8ICdub2NoYW5nZSdcbiAgb3JpZ2luYWxDb2RlOiBzdHJpbmdcbiAgd29yZERpZmY/OiBib29sZWFuXG4gIG1hdGNoZWRMaW5lPzogTGluZU9iamVjdFxufVxuXG4vLyBUeXBlIGZvciB3b3JkLWxldmVsIGRpZmYgcGFydHNcbmludGVyZmFjZSBEaWZmUGFydCB7XG4gIGFkZGVkPzogYm9vbGVhblxuICByZW1vdmVkPzogYm9vbGVhblxuICB2YWx1ZTogc3RyaW5nXG59XG5cbnR5cGUgUHJvcHMgPSB7XG4gIHBhdGNoOiBTdHJ1Y3R1cmVkUGF0Y2hIdW5rXG4gIGRpbTogYm9vbGVhblxuICB3aWR0aDogbnVtYmVyXG59XG5cbi8vIFRocmVzaG9sZCBmb3Igd2hlbiB3ZSBzaG93IGEgZnVsbC1saW5lIGRpZmYgaW5zdGVhZCBvZiB3b3JkLWxldmVsIGRpZmZpbmdcbmNvbnN0IENIQU5HRV9USFJFU0hPTEQgPSAwLjRcblxuZXhwb3J0IGZ1bmN0aW9uIFN0cnVjdHVyZWREaWZmRmFsbGJhY2soe1xuICBwYXRjaCxcbiAgZGltLFxuICB3aWR0aCxcbn06IFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgW3RoZW1lXSA9IHVzZVRoZW1lKClcbiAgY29uc3QgZGlmZiA9IHVzZU1lbW8oXG4gICAgKCkgPT4gZm9ybWF0RGlmZihwYXRjaC5saW5lcywgcGF0Y2gub2xkU3RhcnQsIHdpZHRoLCBkaW0sIHRoZW1lKSxcbiAgICBbcGF0Y2gubGluZXMsIHBhdGNoLm9sZFN0YXJ0LCB3aWR0aCwgZGltLCB0aGVtZV0sXG4gIClcblxuICByZXR1cm4gKFxuICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGZsZXhHcm93PXsxfT5cbiAgICAgIHtkaWZmLm1hcCgobm9kZSwgaSkgPT4gKFxuICAgICAgICA8Qm94IGtleT17aX0+e25vZGV9PC9Cb3g+XG4gICAgICApKX1cbiAgICA8L0JveD5cbiAgKVxufVxuXG4vLyBUcmFuc2Zvcm0gbGluZXMgdG8gbGluZSBvYmplY3RzIHdpdGggdHlwZSBpbmZvcm1hdGlvblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybUxpbmVzVG9PYmplY3RzKGxpbmVzOiBzdHJpbmdbXSk6IExpbmVPYmplY3RbXSB7XG4gIHJldHVybiBsaW5lcy5tYXAoY29kZSA9PiB7XG4gICAgaWYgKGNvZGUuc3RhcnRzV2l0aCgnKycpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb2RlOiBjb2RlLnNsaWNlKDEpLFxuICAgICAgICBpOiAwLFxuICAgICAgICB0eXBlOiAnYWRkJyxcbiAgICAgICAgb3JpZ2luYWxDb2RlOiBjb2RlLnNsaWNlKDEpLFxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29kZS5zdGFydHNXaXRoKCctJykpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNvZGU6IGNvZGUuc2xpY2UoMSksXG4gICAgICAgIGk6IDAsXG4gICAgICAgIHR5cGU6ICdyZW1vdmUnLFxuICAgICAgICBvcmlnaW5hbENvZGU6IGNvZGUuc2xpY2UoMSksXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBjb2RlOiBjb2RlLnNsaWNlKDEpLFxuICAgICAgaTogMCxcbiAgICAgIHR5cGU6ICdub2NoYW5nZScsXG4gICAgICBvcmlnaW5hbENvZGU6IGNvZGUuc2xpY2UoMSksXG4gICAgfVxuICB9KVxufVxuXG4vLyBHcm91cCBhZGphY2VudCBhZGQvcmVtb3ZlIGxpbmVzIGZvciB3b3JkLWxldmVsIGRpZmZpbmdcbmV4cG9ydCBmdW5jdGlvbiBwcm9jZXNzQWRqYWNlbnRMaW5lcyhsaW5lT2JqZWN0czogTGluZU9iamVjdFtdKTogTGluZU9iamVjdFtdIHtcbiAgY29uc3QgcHJvY2Vzc2VkTGluZXM6IExpbmVPYmplY3RbXSA9IFtdXG4gIGxldCBpID0gMFxuXG4gIHdoaWxlIChpIDwgbGluZU9iamVjdHMubGVuZ3RoKSB7XG4gICAgY29uc3QgY3VycmVudCA9IGxpbmVPYmplY3RzW2ldXG4gICAgaWYgKCFjdXJyZW50KSB7XG4gICAgICBpKytcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgLy8gRmluZCBhIHNlcXVlbmNlIG9mIHJlbW92ZSBmb2xsb3dlZCBieSBhZGQgKHBvc3NpYmxlIHdvcmQtbGV2ZWwgZGlmZiBjYW5kaWRhdGVzKVxuICAgIGlmIChjdXJyZW50LnR5cGUgPT09ICdyZW1vdmUnKSB7XG4gICAgICBjb25zdCByZW1vdmVMaW5lczogTGluZU9iamVjdFtdID0gW2N1cnJlbnRdXG4gICAgICBsZXQgaiA9IGkgKyAxXG5cbiAgICAgIC8vIENvbGxlY3QgY29uc2VjdXRpdmUgcmVtb3ZlIGxpbmVzXG4gICAgICB3aGlsZSAoaiA8IGxpbmVPYmplY3RzLmxlbmd0aCAmJiBsaW5lT2JqZWN0c1tqXT8udHlwZSA9PT0gJ3JlbW92ZScpIHtcbiAgICAgICAgY29uc3QgbGluZSA9IGxpbmVPYmplY3RzW2pdXG4gICAgICAgIGlmIChsaW5lKSB7XG4gICAgICAgICAgcmVtb3ZlTGluZXMucHVzaChsaW5lKVxuICAgICAgICB9XG4gICAgICAgIGorK1xuICAgICAgfVxuXG4gICAgICAvLyBDaGVjayBpZiB0aGVyZSBhcmUgYWRkIGxpbmVzIGZvbGxvd2luZyB0aGUgcmVtb3ZlIGxpbmVzXG4gICAgICBjb25zdCBhZGRMaW5lczogTGluZU9iamVjdFtdID0gW11cbiAgICAgIHdoaWxlIChqIDwgbGluZU9iamVjdHMubGVuZ3RoICYmIGxpbmVPYmplY3RzW2pdPy50eXBlID09PSAnYWRkJykge1xuICAgICAgICBjb25zdCBsaW5lID0gbGluZU9iamVjdHNbal1cbiAgICAgICAgaWYgKGxpbmUpIHtcbiAgICAgICAgICBhZGRMaW5lcy5wdXNoKGxpbmUpXG4gICAgICAgIH1cbiAgICAgICAgaisrXG4gICAgICB9XG5cbiAgICAgIC8vIElmIHdlIGhhdmUgYm90aCByZW1vdmUgYW5kIGFkZCBsaW5lcywgcGVyZm9ybSB3b3JkLWxldmVsIGRpZmZpbmdcbiAgICAgIGlmIChyZW1vdmVMaW5lcy5sZW5ndGggPiAwICYmIGFkZExpbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgLy8gRm9yIHdvcmQgZGlmZmluZywgd2UnbGwgY29tcGFyZSBlYWNoIHBhaXIgb2YgbGluZXMgb3IgdGhlIGNsb3Nlc3QgYXZhaWxhYmxlIG1hdGNoXG4gICAgICAgIGNvbnN0IHBhaXJDb3VudCA9IE1hdGgubWluKHJlbW92ZUxpbmVzLmxlbmd0aCwgYWRkTGluZXMubGVuZ3RoKVxuXG4gICAgICAgIC8vIEFkZCBwYWlyZWQgbGluZXMgd2l0aCB3b3JkIGRpZmYgaW5mb1xuICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IHBhaXJDb3VudDsgaysrKSB7XG4gICAgICAgICAgY29uc3QgcmVtb3ZlTGluZSA9IHJlbW92ZUxpbmVzW2tdXG4gICAgICAgICAgY29uc3QgYWRkTGluZSA9IGFkZExpbmVzW2tdXG5cbiAgICAgICAgICBpZiAocmVtb3ZlTGluZSAmJiBhZGRMaW5lKSB7XG4gICAgICAgICAgICByZW1vdmVMaW5lLndvcmREaWZmID0gdHJ1ZVxuICAgICAgICAgICAgYWRkTGluZS53b3JkRGlmZiA9IHRydWVcblxuICAgICAgICAgICAgLy8gU3RvcmUgdGhlIG1hdGNoZWQgcGFpciBmb3IgbGF0ZXIgd29yZCBkaWZmaW5nXG4gICAgICAgICAgICByZW1vdmVMaW5lLm1hdGNoZWRMaW5lID0gYWRkTGluZVxuICAgICAgICAgICAgYWRkTGluZS5tYXRjaGVkTGluZSA9IHJlbW92ZUxpbmVcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgYWxsIHJlbW92ZSBsaW5lcyAoYm90aCBwYWlyZWQgYW5kIHVucGFpcmVkKVxuICAgICAgICBwcm9jZXNzZWRMaW5lcy5wdXNoKC4uLnJlbW92ZUxpbmVzLmZpbHRlcihCb29sZWFuKSlcblxuICAgICAgICAvLyBUaGVuIGFkZCBhbGwgYWRkIGxpbmVzIChib3RoIHBhaXJlZCBhbmQgdW5wYWlyZWQpXG4gICAgICAgIHByb2Nlc3NlZExpbmVzLnB1c2goLi4uYWRkTGluZXMuZmlsdGVyKEJvb2xlYW4pKVxuXG4gICAgICAgIGkgPSBqIC8vIFNraXAgYWxsIHRoZSBsaW5lcyB3ZSd2ZSBwcm9jZXNzZWRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vIG1hdGNoaW5nIGFkZCBsaW5lcywganVzdCBhZGQgdGhlIGN1cnJlbnQgcmVtb3ZlIGxpbmVcbiAgICAgICAgcHJvY2Vzc2VkTGluZXMucHVzaChjdXJyZW50KVxuICAgICAgICBpKytcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm90IGEgcmVtb3ZlIGxpbmUsIGp1c3QgYWRkIGl0XG4gICAgICBwcm9jZXNzZWRMaW5lcy5wdXNoKGN1cnJlbnQpXG4gICAgICBpKytcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcHJvY2Vzc2VkTGluZXNcbn1cblxuLy8gQ2FsY3VsYXRlIHdvcmQtbGV2ZWwgZGlmZnMgYmV0d2VlbiB0d28gdGV4dCBzdHJpbmdzXG5leHBvcnQgZnVuY3Rpb24gY2FsY3VsYXRlV29yZERpZmZzKFxuICBvbGRUZXh0OiBzdHJpbmcsXG4gIG5ld1RleHQ6IHN0cmluZyxcbik6IERpZmZQYXJ0W10ge1xuICAvLyBVc2UgZGlmZldvcmRzV2l0aFNwYWNlIGluc3RlYWQgb2YgZGlmZldvcmRzIHRvIHByZXNlcnZlIHdoaXRlc3BhY2VcbiAgLy8gVGhpcyBlbnN1cmVzIHNwYWNlcyBiZXR3ZWVuIHRva2VucyBsaWtlID4gYW5kIHsgYXJlIHByZXNlcnZlZFxuICBjb25zdCByZXN1bHQgPSBkaWZmV29yZHNXaXRoU3BhY2Uob2xkVGV4dCwgbmV3VGV4dCwgeyBpZ25vcmVDYXNlOiBmYWxzZSB9KVxuXG4gIHJldHVybiByZXN1bHRcbn1cblxuLy8gUHJvY2VzcyB3b3JkLWxldmVsIGRpZmZzIHdpdGggbWFudWFsIHdyYXBwaW5nIHN1cHBvcnRcbmZ1bmN0aW9uIGdlbmVyYXRlV29yZERpZmZFbGVtZW50cyhcbiAgaXRlbTogRGlmZkxpbmUsXG4gIHdpZHRoOiBudW1iZXIsXG4gIG1heFdpZHRoOiBudW1iZXIsXG4gIGRpbTogYm9vbGVhbixcbiAgb3ZlcnJpZGVUaGVtZT86IFRoZW1lTmFtZSxcbik6IFJlYWN0LlJlYWN0Tm9kZVtdIHwgbnVsbCB7XG4gIGNvbnN0IHsgdHlwZSwgaSwgd29yZERpZmYsIG1hdGNoZWRMaW5lLCBvcmlnaW5hbENvZGUgfSA9IGl0ZW1cblxuICBpZiAoIXdvcmREaWZmIHx8ICFtYXRjaGVkTGluZSkge1xuICAgIHJldHVybiBudWxsIC8vIFRoaXMgZnVuY3Rpb24gb25seSBoYW5kbGVzIHdvcmQtbGV2ZWwgZGlmZiByZW5kZXJpbmdcbiAgfVxuXG4gIGNvbnN0IHJlbW92ZWRMaW5lVGV4dCA9XG4gICAgdHlwZSA9PT0gJ3JlbW92ZScgPyBvcmlnaW5hbENvZGUgOiBtYXRjaGVkTGluZS5vcmlnaW5hbENvZGVcbiAgY29uc3QgYWRkZWRMaW5lVGV4dCA9XG4gICAgdHlwZSA9PT0gJ3JlbW92ZScgPyBtYXRjaGVkTGluZS5vcmlnaW5hbENvZGUgOiBvcmlnaW5hbENvZGVcblxuICBjb25zdCB3b3JkRGlmZnMgPSBjYWxjdWxhdGVXb3JkRGlmZnMocmVtb3ZlZExpbmVUZXh0LCBhZGRlZExpbmVUZXh0KVxuXG4gIC8vIENoZWNrIGlmIHdlIHNob3VsZCB1c2Ugd29yZC1sZXZlbCBkaWZmaW5nXG4gIGNvbnN0IHRvdGFsTGVuZ3RoID0gcmVtb3ZlZExpbmVUZXh0Lmxlbmd0aCArIGFkZGVkTGluZVRleHQubGVuZ3RoXG4gIGNvbnN0IGNoYW5nZWRMZW5ndGggPSB3b3JkRGlmZnNcbiAgICAuZmlsdGVyKHBhcnQgPT4gcGFydC5hZGRlZCB8fCBwYXJ0LnJlbW92ZWQpXG4gICAgLnJlZHVjZSgoc3VtLCBwYXJ0KSA9PiBzdW0gKyBwYXJ0LnZhbHVlLmxlbmd0aCwgMClcbiAgY29uc3QgY2hhbmdlUmF0aW8gPSBjaGFuZ2VkTGVuZ3RoIC8gdG90YWxMZW5ndGhcblxuICBpZiAoY2hhbmdlUmF0aW8gPiBDSEFOR0VfVEhSRVNIT0xEIHx8IGRpbSkge1xuICAgIHJldHVybiBudWxsIC8vIEZhbGwgYmFjayB0byBzdGFuZGFyZCByZW5kZXJpbmcgZm9yIG1ham9yIGNoYW5nZXNcbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSBhdmFpbGFibGUgd2lkdGggZm9yIGNvbnRlbnRcbiAgY29uc3QgZGlmZlByZWZpeCA9IHR5cGUgPT09ICdhZGQnID8gJysnIDogJy0nXG4gIGNvbnN0IGRpZmZQcmVmaXhXaWR0aCA9IGRpZmZQcmVmaXgubGVuZ3RoXG4gIGNvbnN0IGF2YWlsYWJsZUNvbnRlbnRXaWR0aCA9IE1hdGgubWF4KFxuICAgIDEsXG4gICAgd2lkdGggLSBtYXhXaWR0aCAtIDEgLSBkaWZmUHJlZml4V2lkdGgsXG4gIClcblxuICAvLyBNYW51YWxseSB3cmFwIHRoZSB3b3JkIGRpZmYgcGFydHMgd2l0aCBiZXR0ZXIgc3BhY2UgZWZmaWNpZW5jeVxuICBjb25zdCB3cmFwcGVkTGluZXM6IHsgY29udGVudDogUmVhY3QuUmVhY3ROb2RlW107IGNvbnRlbnRXaWR0aDogbnVtYmVyIH1bXSA9XG4gICAgW11cbiAgbGV0IGN1cnJlbnRMaW5lOiBSZWFjdC5SZWFjdE5vZGVbXSA9IFtdXG4gIGxldCBjdXJyZW50TGluZVdpZHRoID0gMFxuXG4gIHdvcmREaWZmcy5mb3JFYWNoKChwYXJ0LCBwYXJ0SW5kZXgpID0+IHtcbiAgICAvLyBEZXRlcm1pbmUgaWYgdGhpcyBwYXJ0IHNob3VsZCBiZSBzaG93biBmb3IgdGhpcyBsaW5lIHR5cGVcbiAgICBsZXQgc2hvdWxkU2hvdyA9IGZhbHNlXG4gICAgbGV0IHBhcnRCZ0NvbG9yOiAnZGlmZkFkZGVkV29yZCcgfCAnZGlmZlJlbW92ZWRXb3JkJyB8IHVuZGVmaW5lZFxuXG4gICAgaWYgKHR5cGUgPT09ICdhZGQnKSB7XG4gICAgICBpZiAocGFydC5hZGRlZCkge1xuICAgICAgICBzaG91bGRTaG93ID0gdHJ1ZVxuICAgICAgICBwYXJ0QmdDb2xvciA9ICdkaWZmQWRkZWRXb3JkJ1xuICAgICAgfSBlbHNlIGlmICghcGFydC5yZW1vdmVkKSB7XG4gICAgICAgIHNob3VsZFNob3cgPSB0cnVlXG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAncmVtb3ZlJykge1xuICAgICAgaWYgKHBhcnQucmVtb3ZlZCkge1xuICAgICAgICBzaG91bGRTaG93ID0gdHJ1ZVxuICAgICAgICBwYXJ0QmdDb2xvciA9ICdkaWZmUmVtb3ZlZFdvcmQnXG4gICAgICB9IGVsc2UgaWYgKCFwYXJ0LmFkZGVkKSB7XG4gICAgICAgIHNob3VsZFNob3cgPSB0cnVlXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFzaG91bGRTaG93KSByZXR1cm5cblxuICAgIC8vIFVzZSB3cmFwVGV4dCB0byB3cmFwIHRoaXMgaW5kaXZpZHVhbCBwYXJ0IGlmIGl0J3MgbG9uZ1xuICAgIGNvbnN0IHBhcnRXcmFwcGVkID0gd3JhcFRleHQocGFydC52YWx1ZSwgYXZhaWxhYmxlQ29udGVudFdpZHRoLCAnd3JhcCcpXG4gICAgY29uc3QgcGFydExpbmVzID0gcGFydFdyYXBwZWQuc3BsaXQoJ1xcbicpXG5cbiAgICBwYXJ0TGluZXMuZm9yRWFjaCgocGFydExpbmUsIGxpbmVJZHgpID0+IHtcbiAgICAgIGlmICghcGFydExpbmUpIHJldHVyblxuXG4gICAgICAvLyBDaGVjayBpZiB3ZSBuZWVkIHRvIHN0YXJ0IGEgbmV3IGxpbmVcbiAgICAgIGlmIChcbiAgICAgICAgbGluZUlkeCA+IDAgfHxcbiAgICAgICAgY3VycmVudExpbmVXaWR0aCArIHN0cmluZ1dpZHRoKHBhcnRMaW5lKSA+IGF2YWlsYWJsZUNvbnRlbnRXaWR0aFxuICAgICAgKSB7XG4gICAgICAgIGlmIChjdXJyZW50TGluZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgd3JhcHBlZExpbmVzLnB1c2goe1xuICAgICAgICAgICAgY29udGVudDogWy4uLmN1cnJlbnRMaW5lXSxcbiAgICAgICAgICAgIGNvbnRlbnRXaWR0aDogY3VycmVudExpbmVXaWR0aCxcbiAgICAgICAgICB9KVxuICAgICAgICAgIGN1cnJlbnRMaW5lID0gW11cbiAgICAgICAgICBjdXJyZW50TGluZVdpZHRoID0gMFxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGN1cnJlbnRMaW5lLnB1c2goXG4gICAgICAgIDxUZXh0XG4gICAgICAgICAga2V5PXtgcGFydC0ke3BhcnRJbmRleH0tJHtsaW5lSWR4fWB9XG4gICAgICAgICAgYmFja2dyb3VuZENvbG9yPXtwYXJ0QmdDb2xvcn1cbiAgICAgICAgPlxuICAgICAgICAgIHtwYXJ0TGluZX1cbiAgICAgICAgPC9UZXh0PixcbiAgICAgIClcblxuICAgICAgY3VycmVudExpbmVXaWR0aCArPSBzdHJpbmdXaWR0aChwYXJ0TGluZSlcbiAgICB9KVxuICB9KVxuXG4gIGlmIChjdXJyZW50TGluZS5sZW5ndGggPiAwKSB7XG4gICAgd3JhcHBlZExpbmVzLnB1c2goeyBjb250ZW50OiBjdXJyZW50TGluZSwgY29udGVudFdpZHRoOiBjdXJyZW50TGluZVdpZHRoIH0pXG4gIH1cblxuICAvLyBSZW5kZXIgZWFjaCB3cmFwcGVkIGxpbmUgYXMgYSBzZXBhcmF0ZSBUZXh0IGVsZW1lbnRcbiAgcmV0dXJuIHdyYXBwZWRMaW5lcy5tYXAoKHsgY29udGVudCwgY29udGVudFdpZHRoIH0sIGxpbmVJbmRleCkgPT4ge1xuICAgIGNvbnN0IGtleSA9IGAke3R5cGV9LSR7aX0tJHtsaW5lSW5kZXh9YFxuICAgIGNvbnN0IGxpbmVCZ0NvbG9yID1cbiAgICAgIHR5cGUgPT09ICdhZGQnXG4gICAgICAgID8gZGltXG4gICAgICAgICAgPyAnZGlmZkFkZGVkRGltbWVkJ1xuICAgICAgICAgIDogJ2RpZmZBZGRlZCdcbiAgICAgICAgOiBkaW1cbiAgICAgICAgICA/ICdkaWZmUmVtb3ZlZERpbW1lZCdcbiAgICAgICAgICA6ICdkaWZmUmVtb3ZlZCdcbiAgICBjb25zdCBsaW5lTnVtID0gbGluZUluZGV4ID09PSAwID8gaSA6IHVuZGVmaW5lZFxuICAgIGNvbnN0IGxpbmVOdW1TdHIgPVxuICAgICAgKGxpbmVOdW0gIT09IHVuZGVmaW5lZFxuICAgICAgICA/IGxpbmVOdW0udG9TdHJpbmcoKS5wYWRTdGFydChtYXhXaWR0aClcbiAgICAgICAgOiAnICcucmVwZWF0KG1heFdpZHRoKSkgKyAnICdcbiAgICAvLyBDYWxjdWxhdGUgcGFkZGluZyB0byBmaWxsIHRoZSBlbnRpcmUgdGVybWluYWwgd2lkdGhcbiAgICBjb25zdCB1c2VkV2lkdGggPSBsaW5lTnVtU3RyLmxlbmd0aCArIGRpZmZQcmVmaXhXaWR0aCArIGNvbnRlbnRXaWR0aFxuICAgIGNvbnN0IHBhZGRpbmcgPSBNYXRoLm1heCgwLCB3aWR0aCAtIHVzZWRXaWR0aClcblxuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGtleT17a2V5fSBmbGV4RGlyZWN0aW9uPVwicm93XCI+XG4gICAgICAgIDxOb1NlbGVjdCBmcm9tTGVmdEVkZ2U+XG4gICAgICAgICAgPFRleHRcbiAgICAgICAgICAgIGNvbG9yPXtvdmVycmlkZVRoZW1lID8gJ3RleHQnIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yPXtsaW5lQmdDb2xvcn1cbiAgICAgICAgICAgIGRpbUNvbG9yPXtkaW19XG4gICAgICAgICAgPlxuICAgICAgICAgICAge2xpbmVOdW1TdHJ9XG4gICAgICAgICAgICB7ZGlmZlByZWZpeH1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvTm9TZWxlY3Q+XG4gICAgICAgIDxUZXh0XG4gICAgICAgICAgY29sb3I9e292ZXJyaWRlVGhlbWUgPyAndGV4dCcgOiB1bmRlZmluZWR9XG4gICAgICAgICAgYmFja2dyb3VuZENvbG9yPXtsaW5lQmdDb2xvcn1cbiAgICAgICAgICBkaW1Db2xvcj17ZGltfVxuICAgICAgICA+XG4gICAgICAgICAge2NvbnRlbnR9XG4gICAgICAgICAgeycgJy5yZXBlYXQocGFkZGluZyl9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfSlcbn1cblxuZnVuY3Rpb24gZm9ybWF0RGlmZihcbiAgbGluZXM6IHN0cmluZ1tdLFxuICBzdGFydGluZ0xpbmVOdW1iZXI6IG51bWJlcixcbiAgd2lkdGg6IG51bWJlcixcbiAgZGltOiBib29sZWFuLFxuICBvdmVycmlkZVRoZW1lPzogVGhlbWVOYW1lLFxuKTogUmVhY3QuUmVhY3ROb2RlW10ge1xuICAvLyBFbnN1cmUgd2lkdGggaXMgYXQgbGVhc3QgMSB0byBwcmV2ZW50IHJlbmRlcmluZyBpc3N1ZXMgd2l0aCB2ZXJ5IG5hcnJvdyB0ZXJtaW5hbHNcbiAgY29uc3Qgc2FmZVdpZHRoID0gTWF0aC5tYXgoMSwgTWF0aC5mbG9vcih3aWR0aCkpXG5cbiAgLy8gU3RlcCAxOiBUcmFuc2Zvcm0gbGluZXMgdG8gbGluZSBvYmplY3RzIHdpdGggdHlwZSBpbmZvcm1hdGlvblxuICBjb25zdCBsaW5lT2JqZWN0cyA9IHRyYW5zZm9ybUxpbmVzVG9PYmplY3RzKGxpbmVzKVxuXG4gIC8vIFN0ZXAgMjogR3JvdXAgYWRqYWNlbnQgYWRkL3JlbW92ZSBsaW5lcyBmb3Igd29yZC1sZXZlbCBkaWZmaW5nXG4gIGNvbnN0IHByb2Nlc3NlZExpbmVzID0gcHJvY2Vzc0FkamFjZW50TGluZXMobGluZU9iamVjdHMpXG5cbiAgLy8gU3RlcCAzOiBOdW1iZXIgdGhlIGRpZmYgbGluZXNcbiAgY29uc3QgbHMgPSBudW1iZXJEaWZmTGluZXMocHJvY2Vzc2VkTGluZXMsIHN0YXJ0aW5nTGluZU51bWJlcilcblxuICAvLyBGaW5kIG1heCBsaW5lIG51bWJlciB3aWR0aCBmb3IgYWxpZ25tZW50XG4gIGNvbnN0IG1heExpbmVOdW1iZXIgPSBNYXRoLm1heCguLi5scy5tYXAoKHsgaSB9KSA9PiBpKSwgMClcbiAgY29uc3QgbWF4V2lkdGggPSBNYXRoLm1heChtYXhMaW5lTnVtYmVyLnRvU3RyaW5nKCkubGVuZ3RoICsgMSwgMClcblxuICAvLyBTdGVwIDQ6IFJlbmRlciBmb3JtYXR0aW5nXG4gIHJldHVybiBscy5mbGF0TWFwKChpdGVtKTogUmVhY3QuUmVhY3ROb2RlW10gPT4ge1xuICAgIGNvbnN0IHsgdHlwZSwgY29kZSwgaSwgd29yZERpZmYsIG1hdGNoZWRMaW5lIH0gPSBpdGVtXG5cbiAgICAvLyBIYW5kbGUgd29yZC1sZXZlbCBkaWZmaW5nIGZvciBhZGQvcmVtb3ZlIHBhaXJzXG4gICAgaWYgKHdvcmREaWZmICYmIG1hdGNoZWRMaW5lKSB7XG4gICAgICBjb25zdCB3b3JkRGlmZkVsZW1lbnRzID0gZ2VuZXJhdGVXb3JkRGlmZkVsZW1lbnRzKFxuICAgICAgICBpdGVtLFxuICAgICAgICBzYWZlV2lkdGgsXG4gICAgICAgIG1heFdpZHRoLFxuICAgICAgICBkaW0sXG4gICAgICAgIG92ZXJyaWRlVGhlbWUsXG4gICAgICApXG5cbiAgICAgIC8vIHdvcmQtZGlmZiBtaWdodCByZWZ1c2UgKGUuZy4gZHVlIHRvIGxpbmVzIGJlaW5nIHN1YnN0YW50aWFsbHkgZGlmZmVyZW50KSBpbiB3aGljaFxuICAgICAgLy8gY2FzZSB3ZSdsbCBmYWxsIHRocm91Z2ggdG8gbm9ybWFsIHJlbmRlcmluIGdiZWxvd1xuICAgICAgaWYgKHdvcmREaWZmRWxlbWVudHMgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHdvcmREaWZmRWxlbWVudHNcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTdGFuZGFyZCByZW5kZXJpbmcgZm9yIGxpbmVzIHdpdGhvdXQgd29yZCBkaWZmaW5nIG9yIGFzIGZhbGxiYWNrXG4gICAgLy8gQ2FsY3VsYXRlIGF2YWlsYWJsZSB3aWR0aCBhY2NvdW50aW5nIGZvciBsaW5lIG51bWJlciArIHNwYWNlICsgZGlmZiBwcmVmaXhcbiAgICBjb25zdCBkaWZmUHJlZml4V2lkdGggPSAyIC8vIFwiICBcIiBmb3IgdW5jaGFuZ2VkLCBcIisgXCIgb3IgXCItIFwiIGZvciBjaGFuZ2VzXG4gICAgY29uc3QgYXZhaWxhYmxlQ29udGVudFdpZHRoID0gTWF0aC5tYXgoXG4gICAgICAxLFxuICAgICAgc2FmZVdpZHRoIC0gbWF4V2lkdGggLSAxIC0gZGlmZlByZWZpeFdpZHRoLFxuICAgICkgLy8gLTEgZm9yIHNwYWNlIGFmdGVyIGxpbmUgbnVtYmVyXG4gICAgY29uc3Qgd3JhcHBlZFRleHQgPSB3cmFwVGV4dChjb2RlLCBhdmFpbGFibGVDb250ZW50V2lkdGgsICd3cmFwJylcbiAgICBjb25zdCB3cmFwcGVkTGluZXMgPSB3cmFwcGVkVGV4dC5zcGxpdCgnXFxuJylcblxuICAgIHJldHVybiB3cmFwcGVkTGluZXMubWFwKChsaW5lLCBsaW5lSW5kZXgpID0+IHtcbiAgICAgIGNvbnN0IGtleSA9IGAke3R5cGV9LSR7aX0tJHtsaW5lSW5kZXh9YFxuICAgICAgY29uc3QgbGluZU51bSA9IGxpbmVJbmRleCA9PT0gMCA/IGkgOiB1bmRlZmluZWRcbiAgICAgIGNvbnN0IGxpbmVOdW1TdHIgPVxuICAgICAgICAobGluZU51bSAhPT0gdW5kZWZpbmVkXG4gICAgICAgICAgPyBsaW5lTnVtLnRvU3RyaW5nKCkucGFkU3RhcnQobWF4V2lkdGgpXG4gICAgICAgICAgOiAnICcucmVwZWF0KG1heFdpZHRoKSkgKyAnICdcbiAgICAgIGNvbnN0IHNpZ2lsID0gdHlwZSA9PT0gJ2FkZCcgPyAnKycgOiB0eXBlID09PSAncmVtb3ZlJyA/ICctJyA6ICcgJ1xuICAgICAgLy8gQ2FsY3VsYXRlIHBhZGRpbmcgdG8gZmlsbCB0aGUgZW50aXJlIHRlcm1pbmFsIHdpZHRoXG4gICAgICBjb25zdCBjb250ZW50V2lkdGggPSBsaW5lTnVtU3RyLmxlbmd0aCArIDEgKyBzdHJpbmdXaWR0aChsaW5lKSAvLyBsaW5lTnVtICsgc2lnaWwgKyBjb2RlXG4gICAgICBjb25zdCBwYWRkaW5nID0gTWF0aC5tYXgoMCwgc2FmZVdpZHRoIC0gY29udGVudFdpZHRoKVxuXG4gICAgICBjb25zdCBiZ0NvbG9yID1cbiAgICAgICAgdHlwZSA9PT0gJ2FkZCdcbiAgICAgICAgICA/IGRpbVxuICAgICAgICAgICAgPyAnZGlmZkFkZGVkRGltbWVkJ1xuICAgICAgICAgICAgOiAnZGlmZkFkZGVkJ1xuICAgICAgICAgIDogdHlwZSA9PT0gJ3JlbW92ZSdcbiAgICAgICAgICAgID8gZGltXG4gICAgICAgICAgICAgID8gJ2RpZmZSZW1vdmVkRGltbWVkJ1xuICAgICAgICAgICAgICA6ICdkaWZmUmVtb3ZlZCdcbiAgICAgICAgICAgIDogdW5kZWZpbmVkXG5cbiAgICAgIC8vIEd1dHRlciAobGluZSBudW1iZXIgKyBzaWdpbCkgaXMgd3JhcHBlZCBpbiA8Tm9TZWxlY3Q+IHNvIGZ1bGxzY3JlZW5cbiAgICAgIC8vIHRleHQgc2VsZWN0aW9uIHlpZWxkcyBjbGVhbiBjb2RlLiBiZ0NvbG9yIGNhcnJpZXMgYWNyb3NzIGJvdGggYm94ZXNcbiAgICAgIC8vIHNvIHRoZSB2aXN1YWwgY29udGludWl0eSAoc29saWQgcmVkL2dyZWVuIGJhcikgaXMgdW5jaGFuZ2VkLlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPEJveCBrZXk9e2tleX0gZmxleERpcmVjdGlvbj1cInJvd1wiPlxuICAgICAgICAgIDxOb1NlbGVjdCBmcm9tTGVmdEVkZ2U+XG4gICAgICAgICAgICA8VGV4dFxuICAgICAgICAgICAgICBjb2xvcj17b3ZlcnJpZGVUaGVtZSA/ICd0ZXh0JyA6IHVuZGVmaW5lZH1cbiAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yPXtiZ0NvbG9yfVxuICAgICAgICAgICAgICBkaW1Db2xvcj17ZGltIHx8IHR5cGUgPT09ICdub2NoYW5nZSd9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtsaW5lTnVtU3RyfVxuICAgICAgICAgICAgICB7c2lnaWx9XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPC9Ob1NlbGVjdD5cbiAgICAgICAgICA8VGV4dFxuICAgICAgICAgICAgY29sb3I9e292ZXJyaWRlVGhlbWUgPyAndGV4dCcgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I9e2JnQ29sb3J9XG4gICAgICAgICAgICBkaW1Db2xvcj17ZGltfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIHtsaW5lfVxuICAgICAgICAgICAgeycgJy5yZXBlYXQocGFkZGluZyl9XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgIClcbiAgICB9KVxuICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbnVtYmVyRGlmZkxpbmVzKFxuICBkaWZmOiBMaW5lT2JqZWN0W10sXG4gIHN0YXJ0TGluZTogbnVtYmVyLFxuKTogRGlmZkxpbmVbXSB7XG4gIGxldCBpID0gc3RhcnRMaW5lXG4gIGNvbnN0IHJlc3VsdDogRGlmZkxpbmVbXSA9IFtdXG4gIGNvbnN0IHF1ZXVlID0gWy4uLmRpZmZdXG5cbiAgd2hpbGUgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBjdXJyZW50ID0gcXVldWUuc2hpZnQoKSFcbiAgICBjb25zdCB7IGNvZGUsIHR5cGUsIG9yaWdpbmFsQ29kZSwgd29yZERpZmYsIG1hdGNoZWRMaW5lIH0gPSBjdXJyZW50XG4gICAgY29uc3QgbGluZSA9IHtcbiAgICAgIGNvZGUsXG4gICAgICB0eXBlLFxuICAgICAgaSxcbiAgICAgIG9yaWdpbmFsQ29kZSxcbiAgICAgIHdvcmREaWZmLFxuICAgICAgbWF0Y2hlZExpbmUsXG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGNvdW50ZXJzIGJhc2VkIG9uIGNoYW5nZSB0eXBlXG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICBjYXNlICdub2NoYW5nZSc6XG4gICAgICAgIGkrK1xuICAgICAgICByZXN1bHQucHVzaChsaW5lKVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnYWRkJzpcbiAgICAgICAgaSsrXG4gICAgICAgIHJlc3VsdC5wdXNoKGxpbmUpXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdyZW1vdmUnOiB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGxpbmUpXG4gICAgICAgIGxldCBudW1SZW1vdmVkID0gMFxuICAgICAgICB3aGlsZSAocXVldWVbMF0/LnR5cGUgPT09ICdyZW1vdmUnKSB7XG4gICAgICAgICAgaSsrXG4gICAgICAgICAgY29uc3QgY3VycmVudCA9IHF1ZXVlLnNoaWZ0KCkhXG4gICAgICAgICAgY29uc3QgeyBjb2RlLCB0eXBlLCBvcmlnaW5hbENvZGUsIHdvcmREaWZmLCBtYXRjaGVkTGluZSB9ID0gY3VycmVudFxuICAgICAgICAgIGNvbnN0IGxpbmUgPSB7XG4gICAgICAgICAgICBjb2RlLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIGksXG4gICAgICAgICAgICBvcmlnaW5hbENvZGUsXG4gICAgICAgICAgICB3b3JkRGlmZixcbiAgICAgICAgICAgIG1hdGNoZWRMaW5lLFxuICAgICAgICAgIH1cbiAgICAgICAgICByZXN1bHQucHVzaChsaW5lKVxuICAgICAgICAgIG51bVJlbW92ZWQrK1xuICAgICAgICB9XG4gICAgICAgIGkgLT0gbnVtUmVtb3ZlZFxuICAgICAgICBicmVha1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHRcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLFNBQVNBLGtCQUFrQixFQUFFLEtBQUtDLG1CQUFtQixRQUFRLE1BQU07QUFDbkUsT0FBTyxLQUFLQyxLQUFLLE1BQU0sT0FBTztBQUM5QixTQUFTQyxPQUFPLFFBQVEsT0FBTztBQUMvQixjQUFjQyxTQUFTLFFBQVEsb0JBQW9CO0FBQ25ELFNBQVNDLFdBQVcsUUFBUSwwQkFBMEI7QUFDdEQsU0FBU0MsR0FBRyxFQUFFQyxRQUFRLEVBQUVDLElBQUksRUFBRUMsUUFBUSxFQUFFQyxRQUFRLFFBQVEsY0FBYzs7QUFFdEU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxVQUFVQyxRQUFRLENBQUM7RUFD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