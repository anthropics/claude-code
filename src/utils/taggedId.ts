/**
 * Tagged ID encoding compatible with the API's tagged_id.py format.
 *
 * Produces IDs like "user_01PaGUP2rbg1XDh7Z9W1CEpd" from a UUID string.
 * The format is: {tag}_{version}{base58(uuid_as_128bit_int)}
 *
 * This must stay in sync with api/api/common/utils/tagged_id.py.
 */

const BASE_58_CHARS =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const VERSION = '01'
// ceil(128 / log2(58)) = 22
const ENCODED_LENGTH = 22

/**
 * Encode a 128-bit unsigned integer as a fixed-length base58 string.
 */
function base58Encode(n: bigint): string {
  const base = BigInt(BASE_58_CHARS.length)
  const result = new Array<string>(ENCODED_LENGTH).fill(BASE_58_CHARS[0]!)
  let i = ENCODED_LENGTH - 1
  let value = n
  while (value > 0n) {
    const rem = Number(value % base)
    result[i] = BASE_58_CHARS[rem]!
    value = value / base
    i--
  }
  return result.join('')
}

/**
 * Parse a UUID string (with or without hyphens) into a 128-bit bigint.
 */
function uuidToBigInt(uuid: string): bigint {
  const hex = uuid.replace(/-/g, '')
  if (hex.length !== 32) {
    throw new Error(`Invalid UUID hex length: ${hex.length}`)
  }
  return BigInt('0x' + hex)
}

/**
 * Convert an account UUID to a tagged ID in the API's format.
 *
 * @param tag - The tag prefix (e.g. "user", "org")
 * @param uuid - A UUID string (with or without hyphens)
 * @returns Tagged ID string like "user_01PaGUP2rbg1XDh7Z9W1CEpd"
 */
export function toTaggedId(tag: string, uuid: string): string {
  const n = uuidToBigInt(uuid)
  return `${tag}_${VERSION}${base58Encode(n)}`
}
