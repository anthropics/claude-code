import Json from '../../core/json'

/**
 * The only text that an automatic chart is read from, on every surface.
 *
 * @param storedResult the result as the host stored it
 * @param fallback what to answer where the result holds no text
 * @returns the text of the result, its parts joined by line breaks
 */
export function storedTextOf(storedResult: unknown, fallback = ''): string {
  const isText = typeof storedResult === 'string'

  return isText
    ? storedResult || fallback
    : Json.valuesAt(storedResult, '[].text')
        .filter(text => typeof text === 'string')
        .join('\n') || fallback
}
