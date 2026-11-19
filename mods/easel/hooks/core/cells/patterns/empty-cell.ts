/**
 * `\N` is a NULL of MySQL or PostgreSQL. Prometheus writes `+Inf` for x/0.
 */
export const EMPTY_CELL = /^(?:--?|null|none|nan|n\/a|na|\\n|[-+]inf)?$/i
