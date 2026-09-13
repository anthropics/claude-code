import type { CodeProps, RenderNode } from 'claude-code'

/**
 * The props of every `Code` under a rendered tree node, depth-first in
 * drawing order.
 *
 * @param node an element or a string
 * @returns the Code props
 */
export function codesIn(node: RenderNode): CodeProps[] {
  const isText = typeof node === 'string'
  const isCode = !isText && node.type === 'Code'
  const hasChildren = !isText && 'children' in node

  return isCode
    ? [node.props]
    : hasChildren
      ? (node.children ?? []).flatMap(codesIn)
      : []
}
