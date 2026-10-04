/**
 * A rendered tree node's children as the element table built them, or
 * none for a string, a null, or a childless element.
 *
 * @param node an element, a string child, or anything else
 * @returns the children array, possibly empty
 */
export function childrenOf(node: unknown): readonly unknown[] {
  const isElement = typeof node === 'object' && node !== null
  const held: unknown = isElement ? Reflect.get(node, 'children') : null

  return Array.isArray(held) ? held : []
}
