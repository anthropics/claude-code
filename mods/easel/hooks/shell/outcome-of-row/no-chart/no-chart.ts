import type Easel from '../../../core/easel'

/**
 * A result that holds nothing to draw.
 */
export const NO_CHART = { kind: 'none' } as const satisfies Easel.Outcome
