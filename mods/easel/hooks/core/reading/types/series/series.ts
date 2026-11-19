import type { Sample } from '../sample'

/**
 * One line, one stack layer, one spark or one bar. A bar has one sample.
 * `measure` is the column its values are from.
 */
export type Series = {
  unit: string
  name: string
  measure: string
  samples: Sample[]
}
