import Patterns from '../../../../../patterns'

/**
 * The five named entities and the characters by number. The ampersand comes
 * last, so that `&amp;lt;` stays `&lt;`. A number past the last character
 * stays as it is written.
 *
 * @param text the text of a field
 * @returns the text that it spells
 */
export const unescapedXml = (text: string): string =>
  text
    .replace(
      Patterns.XML_REFERENCE,
      (written, hex?: string, decimal?: string) => {
        const code =
          hex === undefined ? Number(decimal) : Number.parseInt(hex, 16)

        return code <= 0x10ffff ? String.fromCodePoint(code) : written
      },
    )
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
