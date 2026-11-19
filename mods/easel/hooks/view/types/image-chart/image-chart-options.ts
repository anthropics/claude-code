import type { Elements } from 'claude-code'

import type Easel from '../../../core/easel'

/**
 * What the picture that the apps show is made from.
 */
export type ImageChartOptions = {
  /**
   * What the app that shows the picture draws with.
   */
  elements: Elements['desktop' | 'mobile' | 'vscode']

  /**
   * What was drawn, read for its picture and its words for the model.
   */
  chart: Easel.DrawnChart

  /**
   * The width to draw the picture for, when the host gave one.
   */
  columns: number | undefined

  /**
   * How many calls the group holds.
   */
  callCount: number
}
