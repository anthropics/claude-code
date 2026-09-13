import Views from '../../../hooks/views'

/**
 * Whether a block's source is one a `Code` element may carry: at most
 * MAX_CODE_CHARS, counted in UTF-16 units as the engine counts.
 *
 * @param block the block
 * @returns true when the source fits
 */
export const isWithinCodeCap = (block: Views.CodeBlock): boolean =>
  block.source.length <= Views.MAX_CODE_CHARS
