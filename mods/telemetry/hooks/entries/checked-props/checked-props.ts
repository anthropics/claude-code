import { checkedValue } from '../checked-value'
import { isRecord } from '../is-record'
import type { Method } from '../method'
import { PROP_LIMIT } from '../prop-limit'
import { refusal } from '../refusal'
import { TOKEN } from '../token'

/**
 * An entry's properties as they go into the row, or a refusal naming the
 * first thing wrong: the shape, the count, then each key and value in turn.
 *
 * @param props what the caller passed as `props`
 * @param method the method the properties were passed to, named in a refusal
 * @returns the properties by key, each value checked
 */
export function checkedProps(
  props: unknown,
  method: Method,
): Record<string, string | number | boolean> {
  if (!isRecord(props)) {
    throw refusal('props: an object of properties by key', method)
  }

  const entries = Object.entries(props)

  if (entries.length > PROP_LIMIT) {
    throw refusal(`props: at most ${PROP_LIMIT} properties`, method)
  }

  const checked: Record<string, string | number | boolean> = {}

  for (const [key, value] of entries) {
    if (!TOKEN.test(key)) {
      throw refusal('props: every key is a snake_case token', method)
    }

    checked[key] = checkedValue(key, value, method)
  }

  return checked
}
