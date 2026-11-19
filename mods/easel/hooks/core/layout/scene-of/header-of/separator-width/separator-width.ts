import Charting from '../../../../charting'
import Texts from '../../../../texts'

/**
 * The cells that the separator between two texts of the header takes. It is
 * measured when asked, so that loading the module needs no `Intl`.
 *
 * @returns the width of the separator
 */
export const separatorWidth = (): number => Texts.widthOf(Charting.SEPARATOR)
