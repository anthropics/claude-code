/**
 * A lone call has no group to tell of.
 *
 * @param callCount how many calls the auto chart is the newest of
 * @returns the words that send a reader to the rest of the group, or none
 */
export const groupNoteOf = (callCount: number): string =>
  callCount > 1 ? `newest of ${callCount} calls, ctrl+o for the rest · ` : ''
