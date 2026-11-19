/**
 * Which column is the x axis, which hold the values and which split the rows
 * into series, with the form they are drawn in.
 */
export type Roles = {
  form: 'line' | 'columns' | 'bars'
  x: string
  y: string[]
  by: string[]
}
