import Json from '../../../../json'
import Texts from '../../../../texts'
import type Types from '../../../types'

/**
 * A format that has no path to a unit gives none. Several texts at the
 * path are joined with `/`.
 *
 * @param node one series of an answer
 * @param format the paths into a series, with or without one to its unit
 * @returns the short name of what the series is counted in, or `''`
 */
export function unitAt(node: unknown, format: Types.MetricFormat): string {
  const unitPath = format.unit
  const hasUnit = unitPath !== undefined

  return hasUnit
    ? Texts.cleanLabel(Json.valuesAt(node, unitPath).join('/'))
    : ''
}
