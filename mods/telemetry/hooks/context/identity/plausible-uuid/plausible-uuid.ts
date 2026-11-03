import { UUID_LENGTH_FLOOR } from './uuid-length-floor'
import { UUID_LENGTH_LIMIT } from './uuid-length-limit'

/**
 * A value the config holds as an account or organization id, when it is a
 * string long enough to be one; a number or a trivial string is dropped.
 *
 * @param value what the config holds under the key
 * @returns the id, or undefined
 */
export function plausibleUuid(value: unknown): string | undefined {
  const isPlausible =
    typeof value === 'string' &&
    value.length >= UUID_LENGTH_FLOOR &&
    value.length <= UUID_LENGTH_LIMIT

  return isPlausible ? value : undefined
}
