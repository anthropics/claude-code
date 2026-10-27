import type { On, Settings } from 'claude-code'

/**
 * Answers a read of the policy source with one settings object and every
 * other read, a named source or the merge, with another.
 *
 * @param on the test's `on`
 * @param policy what `{ source: "policy" }` reads
 * @param others what any other read answers
 * @returns the registration
 */
export const policyBySource = (on: On, policy: Settings, others: Settings) =>
  on('settings.read', ($, e) => ({
    value: e.source === 'policy' ? policy : others,
  }))
