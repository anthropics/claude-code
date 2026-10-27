import type { ElementQuery } from './element-query.js'

/**
 * The first element in a rendered tree of that type whose `props.key` or
 * `props.label` is the name, depth-first.
 *
 * @param tree what `$.ui.render` resolved to
 * @param wanted the element's type and its key or label
 * @returns the element as a plain record, or undefined
 */
export function elementIn(
  tree: unknown,
  wanted: ElementQuery,
): Record<string, unknown> | undefined {
  if (typeof tree !== 'object' || !tree) {
    return undefined
  }

  const node: Record<string, unknown> = Object.fromEntries(Object.entries(tree))
  const isPropped = typeof node.props === 'object' && node.props !== null

  const named: Record<string, unknown> = isPropped
    ? Object.fromEntries(Object.entries(node.props ?? {}))
    : {}

  const isMatch =
    node.type === wanted.type &&
    (named.key === wanted.name || named.label === wanted.name)

  const children: readonly unknown[] = Array.isArray(node.children)
    ? node.children
    : []

  return isMatch
    ? node
    : children
        .map(child => elementIn(child, wanted))
        .find(found => found !== undefined)
}
