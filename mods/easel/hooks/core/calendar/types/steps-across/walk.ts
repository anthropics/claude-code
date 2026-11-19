import type { Step } from '../step'

/**
 * Where a walk over the calendar begins, how far each stride goes, and the
 * last instant it may reach.
 */
export type Walk = {
  start: readonly number[]
  step: Step
  untilMs: number
  zone: string
}
