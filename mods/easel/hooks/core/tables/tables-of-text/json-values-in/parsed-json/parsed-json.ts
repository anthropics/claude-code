import Limits from '../../../limits'
import { isDeeperThan } from './is-deeper-than'

/**
 * Fails soft: what does not parse is no value, and neither is one nested too
 * deep. Every text of a result is parsed here, so no walk meets such a value.
 *
 * @param text what may be JSON
 * @returns the parsed value, or undefined where there is none to read
 */
export function parsedJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text)

    return isDeeperThan(value, Limits.MAX_JSON_DEPTH) ? undefined : value
  } catch {
    return undefined
  }
}
