/**
 * In UTF-16 code units, not bytes: the refusal's "64 KiB" is exact for ASCII
 * only. Every other limit on cells and on time assumes a shorter text.
 */
export const MAX_INPUT_CHARS = 65_536
