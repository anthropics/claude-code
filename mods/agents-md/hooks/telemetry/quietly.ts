/**
 * Runs one `$.telemetry` call and drops whatever it throws or rejects with.
 *
 * A build with no telemetry noun, a refused row or an ingest that will not
 * take it never disturbs the instructions.
 *
 * @param send the call
 */
export const quietly = (send: () => Promise<void>): void => {
  void Promise.resolve()
    .then(send)
    .catch(() => undefined)
}
