import { autoFooter } from './auto-footer'

/**
 * A chart that the model asked for has no footer.
 *
 * @param autoCallCount how many calls an auto chart is the newest of, if auto
 * @returns the lines to put below the chart, one or none
 */
export const footerOf = (autoCallCount: number | undefined): string[] =>
  autoCallCount === undefined ? [] : [autoFooter(autoCallCount)]
