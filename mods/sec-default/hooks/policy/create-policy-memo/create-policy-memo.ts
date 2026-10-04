import type { Settings } from 'claude-code'

/**
 * A reader of managed policy that serves one read to every caller inside a
 * window after it, rejections included (a failed read still fails closed).
 *
 * @param ttlMs how long a read is served after it starts
 * @param now the clock, for a test
 * @returns `(read) => policy`: `read` runs when nothing fresh is held
 */
export function createPolicyMemo(
  ttlMs: number,
  now: () => number = Date.now,
): (read: () => Promise<Settings>) => Promise<Settings> {
  let heldAt = Number.NEGATIVE_INFINITY
  let held: Promise<Settings> | undefined

  return read => {
    const isStale = held === undefined || now() - heldAt > ttlMs

    if (isStale) {
      heldAt = now()
      held = read()
    }

    return held ?? read()
  }
}
