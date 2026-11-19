/**
 * The stars of `**total**`.
 *
 * The lookbehind lets a run of signs match only from its first: without it,
 * a long run in a cell is tried again from every sign.
 */
export const EMPHASIS = /^[*`]+|(?<![*`])[*`]+$/g
