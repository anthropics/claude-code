import Patterns from '../patterns'
import { KEYS_OF_SHAPES } from './keys-of-shapes'

/**
 * Looks for keys as they are written and parses nothing. A color code or an
 * escape may hide a key, so a text with one may hold metrics.
 *
 * @param rawText the text as it came, with its invisible codes
 * @returns false only where no JSON in the text, however deep, has points
 */
export function mayHoldMetrics(rawText: string): boolean {
  const mayHideKey =
    rawText.includes('\u001B') ||
    (rawText.includes('\\u00') && Patterns.ESCAPED_KEY_PART.test(rawText))

  return (
    mayHideKey ||
    KEYS_OF_SHAPES.some(keys => keys.every(key => rawText.includes(key)))
  )
}
