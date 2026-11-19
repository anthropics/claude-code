/**
 * What stands above the drawing.
 */
export type Header = {
  title: string

  /**
   * The first serves where there is no title.
   */
  facts: string[]

  /**
   * Only the model is told.
   */
  source: string
}
