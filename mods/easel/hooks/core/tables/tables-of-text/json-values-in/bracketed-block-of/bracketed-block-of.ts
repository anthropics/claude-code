import Patterns from '../../../patterns'

/**
 * The lines from the first lone opening bracket to the last lone closing one.
 *
 * @param lines the lines of a text, in order
 * @returns the lines of the block, none where no line opens one
 */
export function bracketedBlockOf(lines: string[]): string[] {
  const startIndex = lines.findIndex(line => Patterns.OPENING_LINE.test(line))
  const hasOpeningLine = startIndex >= 0

  return hasOpeningLine
    ? lines.slice(
        startIndex,
        lines.findLastIndex(line => Patterns.CLOSING_LINE.test(line)) + 1,
      )
    : []
}
