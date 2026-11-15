import type { Call } from './call.js'
import { CODE_TOOLS } from './code-tools.js'

/**
 * Whether two calls are one tool on the same arguments, in any order of
 * keys; for a tool that runs a command or a script, on the same one.
 *
 * @param one a call
 * @param other another
 * @returns true when running either is running the other
 */
export function isSameCall(one: Call, other: Call): boolean {
  const key = CODE_TOOLS.get(one.tool)

  return (
    one.tool === other.tool &&
    (key !== undefined && one.input[key] !== undefined
      ? one.input[key] === other.input[key]
      : sortedJson(one.input) === sortedJson(other.input))
  )
}

// Once for each input: a remembered one is compared at every later call.
// A mod can pass a BigInt, which JSON refuses: a throw here would skip the row.
const texts = new WeakMap<object, string>()

function sortedJson(input: object): string {
  const text =
    texts.get(input) ??
    JSON.stringify(input, (_key, inner: unknown) =>
      typeof inner === 'object' && inner !== null && !Array.isArray(inner)
        ? Object.fromEntries(
            Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : 1)),
          )
        : typeof inner === 'bigint'
          ? Number(inner)
          : inner,
    )
  texts.set(input, text)

  return text
}
