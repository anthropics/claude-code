import type { TargetTier } from 'claude-code'

/**
 * What the shared hook needs of `next` on those events: the call, and the
 * continuation past the user tier.
 */
export type ProvidedNext<E, R> = {
  (e: E): Promise<R>

  /**
   * Continues the dispatch at `tier`, the links between skipped (Next's).
   */
  readonly to: (e: E, tier: TargetTier) => Promise<R>
}
