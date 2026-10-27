/**
 * Code point ranges that take no cell: combining marks, zero-width spaces
 * and joiners, variation selectors.
 */
export const ZERO_WIDTH_RANGES: readonly (readonly [number, number])[] = [
  [0x0300, 0x036f],
  [0x200b, 0x200f],
  [0xfe00, 0xfe0f],
  [0x20d0, 0x20ff],
]
