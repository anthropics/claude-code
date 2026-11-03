import type { Settings } from 'claude-code'

/**
 * Whether the policy read is one the person could have written: the host
 * marks it where no administrator's document composes it.
 *
 * Such a policy may hold; no grant is taken from it.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @returns true for a policy so marked
 */
export const isPersonWritable = (policy: Settings): boolean =>
  policy.personWritablePolicy === true
