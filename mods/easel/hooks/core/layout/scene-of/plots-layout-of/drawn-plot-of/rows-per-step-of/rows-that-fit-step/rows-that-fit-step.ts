/**
 * In rows for each step. Ticks stand mid-row, so the rows span one row less.
 *
 * @param maxRows the most rows that a plot may take
 * @param stepsShown the steps between ticks that those rows span
 * @returns the whole rows that fit one step
 */
export const rowsThatFitStep = (maxRows: number, stepsShown: number): number =>
  Math.floor((maxRows - 1) / stepsShown)
