/**
 * The trailing-edge wait between a trigger (an edit, a shell command, a turn
 * step) and the refetch it causes, so a burst of edits fetches once.
 */
export const REFRESH_DEBOUNCE_MS = 150
