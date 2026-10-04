import { HEX_RADIX } from './hex-radix'

/**
 * A buffer's bytes as lowercase hex, two digits each.
 *
 * @param buffer the bytes
 * @returns the hex text
 */
export const hexOf = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)]
    .map(byte => byte.toString(HEX_RADIX).padStart(2, '0'))
    .join('')
