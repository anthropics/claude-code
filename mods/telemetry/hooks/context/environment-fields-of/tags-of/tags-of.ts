/**
 * The row's `tags` field: the variable split on commas and trimmed, or
 * undefined when it names none.
 *
 * @param variable CLAUDE_CODE_TAGS as read
 * @returns the field, or undefined
 */
export function tagsOf(variable: string | undefined) {
  const listed = (variable ?? '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)

  return listed.length > 0 ? listed : undefined
}
