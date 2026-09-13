/**
 * A rendered tree's text as it reads: its strings and its labels, in order.
 *
 * @param tree what `$.ui.render` resolved to, or a part of it
 * @returns the text
 */
export function textOf(tree: unknown): string {
  if (typeof tree === 'string' || typeof tree === 'number') {
    return String(tree)
  }

  if (Array.isArray(tree)) {
    return tree.map(textOf).join('')
  }

  if (typeof tree !== 'object' || !tree) {
    return ''
  }

  const props: unknown = Reflect.get(tree, 'props')

  const label: unknown =
    typeof props === 'object' && props ? Reflect.get(props, 'label') : undefined

  const lead = typeof label === 'string' ? label : ''

  return `${lead}${textOf(Reflect.get(tree, 'children') ?? [])}`
}
