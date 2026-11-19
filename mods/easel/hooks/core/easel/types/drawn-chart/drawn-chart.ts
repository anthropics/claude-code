import type Raster from '../../../raster'
import type { Usage } from '../../../usage'

/**
 * Its words are made once, so every surface states the same numbers.
 */
export type DrawnChart = {
  /**
   * The word that tells this answer from a refusal and from nothing.
   */
  kind: 'chart'

  /**
   * It is the image's alt text too.
   */
  modelText: string

  /**
   * Paints for a terminal that many columns wide, as rows of styled runs.
   */
  terminalRows: (columns: number) => Raster.Run[][]

  /**
   * Paints an image as wide as its pane, and never wider than a pane gets.
   */
  svg: (columns?: number) => string

  /**
   * What telemetry is told of the chart: no text of the data.
   */
  usage: Usage
}
