/**
 * Both instants are included.
 *
 * An instant is epoch milliseconds. A zone is an IANA name, as
 * `Europe/Paris`.
 */
export type TimeSpan = { fromMs: number; untilMs: number; zone: string }
