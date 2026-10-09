/**
 * The events whose hook continues past the user tier whoever asks.
 */
export const PASS_OVER_EVENTS = Object.freeze([
  'classic.*',
  'settings.read',
] as const)
