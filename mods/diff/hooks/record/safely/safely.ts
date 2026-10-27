/**
 * Sends one telemetry row and forgets it: a missing `$.telemetry` (no
 * telemetry built-in) throws synchronously, a refused row rejects; both drop.
 *
 * @param send posts the row
 */
export function safely(send: () => Promise<void>) {
  try {
    void send().catch(() => undefined)
  } catch {}
}
