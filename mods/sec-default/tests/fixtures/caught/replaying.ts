import type { TargetTier } from 'claude-code'

/**
 * A failure handler's `next` for a hook that had called it: the call
 * replays what that last call settled to.
 *
 * Its `to` answers `to`, to tell the two apart.
 *
 * @param last what the failed hook's last call settled to
 * @returns the stand-in
 */
export const replaying = (last: string) =>
  Object.assign((_e: unknown) => Promise.resolve(last), {
    to: (_e: unknown, _tier: TargetTier) => Promise.resolve('to'),
    called: true,
    error: { kind: 'throw' },
    origin: { tier: 'user' },
  })
