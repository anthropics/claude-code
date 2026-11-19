import type Shapes from '../../../../shapes'

/**
 * The words of a line with the three signs that would read as markup
 * written as character references.
 *
 * @param shape the line of words to write
 * @returns the words, safe as the content of an element
 */
export const escapedText = (shape: Shapes.TextShape): string =>
  shape.text.replace(/[&<>]/g, sign => `&#${sign.charCodeAt(0)};`)
