/**
 * `zone` is an IANA zone. `nowMs` is null where there is no clock.
 */
export type CallClock = { zone: string; nowMs: number | null }
