import type { HeaderTotals } from '../header-totals'

/**
 * The header's counts when no fetch has settled into data: nothing
 * changed, nothing past the cap.
 */
export const ZERO_TOTALS: HeaderTotals = Object.freeze({
  filesCount: 0,
  linesAdded: 0,
  linesRemoved: 0,
  notShown: 0,
})
