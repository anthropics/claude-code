import Views from '../../../hooks/views'

/**
 * Whether a source is one a `Code` element may carry: at most
 * MAX_CODE_CHARS, counted in UTF-16 units as the engine counts.
 *
 * @param source the block's source
 * @returns true when the source fits
 */
export const isWithinCodeCap = (source: string): boolean =>
  source.length <= Views.MAX_CODE_CHARS
