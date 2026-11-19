import type Types from '../../types'

/**
 * The line starts with a word of this plugin, and the label comes last.
 *
 * @param mark a moment the call wants pointed out
 * @returns the line the model reads of it
 */
export function markLineOf(mark: Types.Mark): string {
  const hasLabel = mark.label !== ''

  return hasLabel
    ? `mark at ${mark.when}: ${mark.label}`
    : `mark at ${mark.when}`
}
