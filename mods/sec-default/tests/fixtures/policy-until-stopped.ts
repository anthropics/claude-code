import type { On, Settings } from 'claude-code'

/**
 * Answers every settings read beneath the plugins with the policy given
 * until the answer is called; every read after it is refused.
 *
 * So a test's plugins load under a policy that reads, and meet one that
 * does not.
 *
 * @param on the test's `on`
 * @param policy the managed settings in force while reads are answered
 * @param reason what a read is denied with once stopped
 * @returns `() => void`: from then on a read is denied
 */
export function policyUntilStopped(on: On, policy: Settings, reason: string) {
  let isStopped = false

  on('settings.read', () => (isStopped ? { deny: reason } : { value: policy }))

  return () => {
    isStopped = true
  }
}
