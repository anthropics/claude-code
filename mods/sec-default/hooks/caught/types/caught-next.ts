import type { TargetTier } from 'claude-code'

/**
 * What a failure handler needs of its `next`: the call, the continuation
 * past the user tier, and whether the failed hook had called either.
 *
 * The call replays the failed hook's last run, or runs the links beneath.
 */
export type CaughtNext<E, R> = {
  (e: E): Promise<R>

  /**
   * Continues the dispatch at `tier`, the links between skipped (Next's).
   */
  readonly to: (e: E, tier: TargetTier) => Promise<R>

  /**
   * True when the failed hook had called `next` or `next.to` (Caught's).
   */
  readonly called: boolean
}
