import { MOST_UTF8_BYTES } from '../most-utf8-bytes'

/**
 * Whether the text's UTF-8 encoding stays under a byte count, encoding it
 * only when its length alone cannot already say so.
 *
 * @param text the text
 * @param ceiling the byte count it must stay under
 * @returns whether it is under
 */
export const isUnderUtf8Ceiling = (text: string, ceiling: number) =>
  text.length * MOST_UTF8_BYTES < ceiling ||
  new TextEncoder().encode(text).length < ceiling
