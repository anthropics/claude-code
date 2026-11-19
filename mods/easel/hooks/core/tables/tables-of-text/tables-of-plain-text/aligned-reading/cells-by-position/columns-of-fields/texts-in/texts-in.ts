import type Types from '../../../../../../types'

/**
 * The part of each string inside one span, padded to its width.
 *
 * @param lines the lines to cut
 * @param field the span of positions to cut out of each
 * @returns one text a line, each as wide as the span
 */
export const textsIn = (lines: string[], field: Types.Field): string[] =>
  lines.map(line =>
    line.slice(field.from, field.until).padEnd(field.until - field.from),
  )
