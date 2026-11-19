/**
 * What a Grafana frame states of one of its fields in its schema, with the
 * cells of that field.
 */
export type GrafanaField = {
  /**
   * What the schema calls the field, which queries reuse.
   */
  name: string

  /**
   * What Grafana shows the field as, when the data source gave that.
   */
  displayName: unknown

  /**
   * `time`, `number` or `string`.
   */
  type: unknown

  /**
   * A record of the tags that tell this field from others of its query.
   */
  labels: unknown

  /**
   * The short name of what the cells are counted in, or `''`.
   */
  unit: string

  /**
   * One value per row of the frame.
   */
  cells: unknown[]
}
