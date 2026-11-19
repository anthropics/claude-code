/**
 * Combining marks take no cell, so a limit on width alone does not limit the
 * length. The half on top leaves room for accents and surrogate pairs.
 */
export const MAX_CODE_UNITS_PER_CELL = 1.5
