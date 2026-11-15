import type { Call } from './call.js'

const DEPTH = 64
const VALUES = 10_000
const MATCHED_BY = /^(command|code|file_path|notebook_path)$/

/**
 * A call that is cheap to walk, each value as JSON writes it: whole, or past 64
 * levels or 10,000 values laid flat, its command, script or file and its first
 * values kept. Never throws.
 *
 * @param call any call
 * @returns the call to remember or to match
 */
export function bounded(call: Call): Call {
  const walked: [value: unknown, depth: number][] = [[call.input, 0]]

  for (const [value, depth] of walked) {
    if (walked.length > VALUES) {
      break
    }

    if (typeof value === 'object' && value !== null) {
      for (const inner of Object.values(value)) {
        walked.push([unwrapped(inner), depth + 1])
      }
    }
  }

  const isSmall =
    walked.length <= VALUES &&
    walked.every(
      ([value, depth]) =>
        depth <= DEPTH && !(Array.isArray(value) && value.length > VALUES),
    )

  if (isSmall) {
    const text = JSON.stringify(call.input, (_key, value: unknown) =>
      unwrapped(value),
    )

    return { ...call, input: Object(JSON.parse(text)) }
  }

  const isPlain = (value: unknown) => typeof value !== 'object'
  const named = Object.entries(call.input)
    .map(([key, value]) => [key, unwrapped(value)] as const)
    .filter(([key, value]) => MATCHED_BY.test(key) && isPlain(value))
  const values = walked.slice(0, VALUES).map(([value]) => value)

  return {
    ...call,
    input: { ...Object.fromEntries(named), values: values.filter(isPlain) },
  }
}

// A mod can pass a wrapped string or a date, which a server is sent as plain text, and a BigInt, which JSON refuses.
function unwrapped(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return typeof value === 'bigint' ? Number(value) : value
  }

  try {
    // With no key listed, nothing beneath the value is walked.
    const written: unknown = JSON.parse(JSON.stringify(value, []))

    return typeof written === 'object' && written !== null ? value : written
  } catch {
    return Number(value)
  }
}
