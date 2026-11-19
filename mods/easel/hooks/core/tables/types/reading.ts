import type Casting from '../../casting'

/**
 * The tables one way of reading finds, and how many lines they cover.
 */
export type Reading = {
  tables: Casting.Table[]
  lineCount: number
}
