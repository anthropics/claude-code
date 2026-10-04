import type { Settings } from 'claude-code'

/**
 * A yes/no read off managed policy that fails closed: true (protect) when
 * the read rejects or deciding throws.
 *
 * @param policy the memoized policy read (createPolicyMemo over the hook's
 * `$.settings.read({ source: "policy" })`)
 * @param decide the answer once the policy is read
 * @returns what decide answers, else true
 */
export const decidedByPolicy = (
  policy: Promise<Settings>,
  decide: (policy: Settings) => boolean,
): Promise<boolean> => policy.then(decide).catch(() => true)
