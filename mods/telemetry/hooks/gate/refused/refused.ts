/**
 * The answer a caller outside the served tiers gets for a row or a mark: its
 * promise rejects with this, and the host notes it in the debug log.
 */
export const REFUSED = {
  deny: '$.telemetry rows and marks are for the plugins built into Claude Code',
} as const
