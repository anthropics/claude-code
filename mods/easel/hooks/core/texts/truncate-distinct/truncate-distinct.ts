import Patterns from '../patterns'
import { truncateMiddle } from '../truncate-middle'
import { widthOf } from '../width-of'
import { tailOf } from './tail-of'

/**
 * Cuts labels shown together to a width, keeping what tells them apart.
 *
 * First drops the whole words that every label starts with: `api-server-`.
 * A word that the labels only begin alike (`east`, `eats`) is not shared.
 *
 * @param names the labels shown together
 * @param maxWidth the most cells each result may take
 * @returns the labels in the same order, each cut to fit
 */
export function truncateDistinct(names: string[], maxWidth: number): string[] {
  const [first = [], ...others] = names.map(name => [...name])
  const sharedCount =
    first
      .slice(
        0,
        Math.max(
          0,
          first.findIndex((codePoint, index) =>
            others.some(other => other[index] !== codePoint),
          ),
        ),
      )
      .findLastIndex(codePoint => !Patterns.WORD_CHARACTER.test(codePoint)) + 1
  const isCut = sharedCount > 0 && names.some(name => widthOf(name) > maxWidth)

  return names.map(name =>
    truncateMiddle(isCut ? tailOf(name, sharedCount) : name, maxWidth),
  )
}
