import Limits from '../../limits'

/**
 * The median, so that one odd gap does not decide the step.
 *
 * @param differences the time from each sample to the next
 * @returns the one in the middle once sorted, or 0 where there is none
 */
export const stepGapOf = (differences: readonly number[]): number =>
  differences.toSorted((shorter, longer) => shorter - longer)[
    Math.floor(differences.length / Limits.HALVES)
  ] ?? 0
