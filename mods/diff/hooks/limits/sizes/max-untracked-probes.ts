/**
 * How many untracked paths get a timestamp probe per fetch; the rest read as
 * pre-session, since only MAX_FILES rows could ever show.
 */
export const MAX_UNTRACKED_PROBES = 500
