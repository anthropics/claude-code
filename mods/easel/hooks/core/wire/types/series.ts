/**
 * What is read of one line of a chart before its points are made: the
 * labels every point gets, and the cells each point has for itself.
 */
export type Series = {
  /**
   * A name and a value per label, the same for every point.
   */
  labels: Array<[string, unknown]>

  /**
   * The keys of a point that hold a measure.
   */
  y: string[]

  /**
   * How many points the times give.
   */
  pointCount: number

  /**
   * The keys that each point has for itself, each with its cell per point.
   */
  cellsByKey: Array<[string, unknown[]]>
}
