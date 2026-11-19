import type { Step } from './step'

/**
 * Every period from the first sample to the last, which ends at `endMs`.
 */
export type SampleGrid = { step: Step; periodStarts: number[]; endMs: number }
