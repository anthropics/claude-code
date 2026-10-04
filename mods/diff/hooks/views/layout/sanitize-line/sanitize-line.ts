import { TAB_WIDTH } from '../tab-width'

/**
 * A diff line made safe to measure and draw: tabs become spaces, and every
 * control, format and default-ignorable character is dropped.
 *
 * The render tree refuses control characters; the rest (bidi overrides,
 * zero-width spaces and joiners, variation selectors, the soft hyphen)
 * draw as nothing, so nothing invisible can reorder, hide or pad a line.
 *
 * @param text one line of file content
 * @returns the drawable line
 */
export const sanitizeLine = (text: string) =>
  text
    .replaceAll('\t', ' '.repeat(TAB_WIDTH))
    .replace(/[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/gu, '')
