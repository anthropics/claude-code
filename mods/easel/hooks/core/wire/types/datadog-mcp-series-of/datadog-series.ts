/**
 * What the `Datadog` format reads of one series: a time and a value per
 * point.
 */
export type DatadogSeries = {
  /**
   * The expression that was asked for, as the service wrote it.
   */
  metric: unknown

  /**
   * The tags the series is narrowed to, or `*` for none.
   */
  scope: unknown

  /**
   * One pair per point: its time, then its value.
   */
  pointlist: unknown[][]
}
