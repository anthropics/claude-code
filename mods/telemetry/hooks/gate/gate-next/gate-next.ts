import type { Origin } from 'claude-code'

/**
 * What the gate reads of the continuation it is handed: the hooks beneath
 * to go on to, and who raised the call, as the host stamped it.
 */
export type GateNext<E, R> = ((e: E) => R) & { readonly origin?: Origin }
