/**
 * The `$.store` key the nudge's outcome is kept under, across sessions.
 *
 * Unset until a nudge is shown, then `shown`, then `acted` once a later load
 * runs under another mode.
 */
export const NUDGE_KEY = 'nudge'
