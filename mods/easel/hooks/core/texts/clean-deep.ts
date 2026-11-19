import { cleanLabel } from './clean-label'

/**
 * Every string inside a structure, cleaned the way a label is.
 *
 * Keys are not cleaned. The result has the shape of the input only because
 * cleaning turns a string into a string.
 *
 * @param value a structure that survives a round trip through JSON
 * @returns a copy in which each string is cleaned
 */
export function cleanDeep<Value>(value: Value): Value {
  const cleanedTexts = new Map<string, string>()

  return JSON.parse(JSON.stringify(value), (_key, node) => {
    const isString = typeof node === 'string'

    if (!isString) {
      return node
    }

    const label = cleanedTexts.get(node) ?? cleanLabel(node)
    cleanedTexts.set(node, label)

    return label
  })
}
