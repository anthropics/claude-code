/**
 * What branch mode resolved its base to, as a base-resolve mark names it,
 * the built-in panel's own: the merge base, HEAD itself, or nothing.
 */
export const BASE_OUTCOMES = ['merge-base', 'head-is-base', 'none'] as const
