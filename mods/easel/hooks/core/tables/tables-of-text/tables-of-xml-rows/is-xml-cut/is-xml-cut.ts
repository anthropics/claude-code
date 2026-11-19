import Patterns from '../../../patterns'
import Words from '../../../words'

/**
 * The tool says that it left rows out, or the text ends inside a row.
 *
 * @param text a text that holds rows of XML
 * @returns whether its rows cannot be trusted to be all of them
 */
export const isXmlCut = (text: string): boolean =>
  Patterns.XML_CUT.test(text) ||
  text.lastIndexOf(Words.XML_ROW_OPEN) > text.lastIndexOf(Words.XML_ROW_CLOSE)
