import type Cells from '../../../../../../cells'
import Texts from '../../../../../../texts'
import Limits from '../../../../../limits'

/**
 * The first few texts of a column, each cut to a width that shows what the
 * column looks like without handing the data back.
 *
 * @param texts the distinct texts of one column
 * @returns the texts that the line quotes
 */
export const samplesOf = (texts: Cells.Cell[]): string[] =>
  texts
    .slice(0, Limits.MAX_SAMPLES)
    .map(cell => Texts.truncateMiddle(String(cell), Limits.MAX_SAMPLE_WIDTH))
