import { isRecord } from '../is-record'

/**
 * A value with every object key respelled for the event-logging ingest:
 * `platformRaw` as `platform_raw`, all the way down; arrays and leaves kept.
 *
 * @param value the row, or a part of it, keyed as the plugin builds it
 * @returns the same value keyed as the ingest reads it
 */
export function wireOf(value: unknown): unknown {
  const isList = Array.isArray(value)
  const isObject = isRecord(value)

  return isList
    ? value.map(wireOf)
    : isObject
      ? Object.fromEntries(
          Object.entries(value).map(([key, member]) => [
            key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
            wireOf(member),
          ]),
        )
      : value
}
