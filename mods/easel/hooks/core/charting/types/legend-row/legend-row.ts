import type Shapes from '../../../shapes'
import type { Stat } from '../stat'

/**
 * One series as the legend tells it.
 */
export type LegendRow = {
  /**
   * The letter that ties the row to its ink, or '' where none is needed.
   */
  key: string

  name: string

  /**
   * The most wanted stat comes first: a narrow layout drops the last ones.
   */
  stats: Stat[]

  ink: Shapes.Ink
}
