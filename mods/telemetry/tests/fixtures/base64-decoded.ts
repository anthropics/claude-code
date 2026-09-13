import { BASE64_ALPHABET } from './base64-alphabet.js'
import { BASE64_DIGIT_BITS } from './base64-digit-bits.js'

/**
 * The text a base64 string encodes, byte for byte (the rows carry ASCII
 * JSON), so a test reads a batch's `additional_metadata` back.
 *
 * @param encoded the base64 text
 * @returns the decoded text
 */
export const base64Decoded = (encoded: string): string =>
  (
    [...encoded.replace(/=+$/, '')]
      .map(digit =>
        BASE64_ALPHABET.indexOf(digit)
          .toString(2)
          .padStart(BASE64_DIGIT_BITS, '0'),
      )
      .join('')
      .match(/[01]{8}/g) ?? []
  )
    .map(byte => String.fromCharCode(parseInt(byte, 2)))
    .join('')
