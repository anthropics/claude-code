import type Types from '../types'

/**
 * Months and years by their mean length, to rank one against another.
 *
 * @param step the unit and how many of it
 * @returns the usual length in milliseconds
 */
export const typicalStepMs = (step: Types.Step): number =>
  step.unit.typicalMs * step.count
