import type Types from '../../types'

/**
 * The title stands in double quotes after a space, and its own double quotes
 * become single ones, so that it cannot end the quote early.
 *
 * @param header what stands above the chart
 * @returns the quoted title to put after the form, or nothing without one
 */
export const quotedTitleOf = (header: Types.Header): string =>
  header.title === '' ? '' : ` "${header.title.replaceAll('"', "'")}"`
