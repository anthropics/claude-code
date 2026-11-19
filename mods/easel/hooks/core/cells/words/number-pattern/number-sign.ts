/**
 * A sign or an opening bracket, then at most one money sign.
 */
export const NUMBER_SIGN = String.raw`^(?<sign>[-+−(]?)(?<currency>[$€£¥])?`
