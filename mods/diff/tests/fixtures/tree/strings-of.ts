import { childrenOf } from './children-of.js'

/**
 * Every string child under a rendered tree node, depth-first in drawing
 * order: what the engine counts against its text caps.
 *
 * @param node an element or a string
 * @returns the strings
 */
export const stringsOf = (node: unknown): string[] =>
  typeof node === 'string' ? [node] : childrenOf(node).flatMap(stringsOf)
