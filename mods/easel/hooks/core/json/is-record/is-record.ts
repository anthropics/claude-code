/**
 * Whether a piece of parsed JSON is an object that holds keys.
 *
 * @param node anything a parsed text may hold
 * @returns whether it is an object, and neither null nor an array
 */
export const isRecord = (node: unknown): node is Record<string, unknown> =>
  typeof node === 'object' && node !== null && !Array.isArray(node)
