/**
 * The tiers a trace entry can carry when a plugin a person installed ran in
 * it: `user`, and `prepend` beneath this plugin's own seat.
 *
 * The engine runs neighbouring plugins that share a worker as one batch and
 * lists the batch under its first member's tier, so an organization's
 * prepended plugin can stand for a batch that holds a person's.
 */
export const TIERS_HOLDING_USERS: readonly unknown[] = Object.freeze([
  'user',
  'prepend',
])
