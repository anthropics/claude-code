import type { On, Settings } from 'claude-code'

/**
 * Answers every settings read beneath the plugins with the policy given,
 * counting the reads.
 *
 * @param on the test's `on`
 * @param policy the managed settings in force
 * @returns how many reads reached the bottom so far
 */
export function policyReads(on: On, policy: Settings): () => number {
  let reads = 0

  on('settings.read', () => {
    reads += 1

    return { value: policy }
  })

  return () => reads
}
