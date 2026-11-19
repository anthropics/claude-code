/**
 * What the answer of a metrics service was read as, whatever its format.
 */
export type Metrics = {
  /**
   * The name of the format the answer was read as.
   */
  source: string

  /**
   * The keys of a point that hold a value: `value`, or names from Grafana.
   */
  y: string[]

  /**
   * One record per point: its labels, its `time` and a value per `y` key.
   */
  points: Array<Record<string, unknown>>

  /**
   * Whether the answer says itself that its values are measures over time. A
   * frame of Grafana's may be any table, such as the rows of a SQL query.
   */
  isSeries: boolean

  /**
   * Whether each value is whole at its time, so the last is never half made.
   */
  isReadAtInstants: boolean
}
