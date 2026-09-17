/**
 * How long the nudge stays on the notification bar.
 *
 * It is raised at the session's start, before the first frame settles and
 * while the engine's own startup notices take their turns on the bar, so
 * the bar's default few seconds can pass before the person reads it.
 */
export const NUDGE_TIMEOUT_MS = 10_000
