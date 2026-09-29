import type { TraceEntry } from 'claude-code'

/**
 * The plugins a person installed that answered `allow` or `ask` in one run
 * of `tool.check`, by name, nearest the caller first.
 *
 * Read off `next.trace`: each link's `tier` is pinned by the engine, and a
 * link that was skipped or rejected settled on nothing.
 *
 * @param trace what settled beneath the hook on its latest `next` call
 * @returns the names; none when no user-tier link answered looser than deny
 */
export const loosenedByUsers = (
  trace: readonly TraceEntry<'tool.check'>[],
): readonly string[] =>
  trace
    .filter(
      link =>
        link.tier === 'user' &&
        link.returned !== undefined &&
        link.returned.decision !== 'deny',
    )
    .map(link => link.plugin)
