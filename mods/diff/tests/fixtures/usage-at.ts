/**
 * What `$.session.usage()` answers for a session that began at the given
 * moment: an empty window, no rate limits, nothing spent.
 *
 * Left untyped, so it compiles against declarations that predate `startedAt`.
 *
 * @param startedAt when the session began, by the test's clock
 * @returns the usage
 */
export const usageAt = (startedAt: number) => ({
  startedAt,
  context: { window: 200_000 },
  rateLimits: [],
})
