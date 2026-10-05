import type { TargetTier } from 'claude-code'

/**
 * What the `tool.register` decision needs of `next`: the call, the
 * continuation past the user tier, and the caller's pinned tier.
 */
export type RegisterNext<E, R> = {
  (e: E): Promise<R>

  /**
   * Continues the dispatch at `tier`, the links between skipped (Next's).
   */
  readonly to: (e: E, tier: TargetTier) => Promise<R>

  /**
   * Who raised the dispatch (Next's), read for its tier.
   */
  readonly origin: { readonly tier: unknown }
}
