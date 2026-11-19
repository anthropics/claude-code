import type Reading from '../../../reading'
import type { SizedSeries } from '../sized-series'

/**
 * What a note about the series that were cut is written from.
 */
export type CutNotesOptions = {
  form: Reading.Data['form']
  cutSeries: SizedSeries[]
  drawnAloneCount: number
  isRestDrawnAsOne: boolean
  formLimit: number
  top: number | undefined
}
