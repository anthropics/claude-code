/**
 * The answer a caller the gate does not serve gets for a row or a mark: its
 * promise rejects with this, and the host notes it in the debug log.
 */
export const REFUSED = {
  deny: '$.telemetry rows and marks are for built-in plugins and official ones',
} as const
