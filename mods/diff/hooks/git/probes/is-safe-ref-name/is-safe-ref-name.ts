import { SAFE_REF_PATTERN } from './safe-ref-pattern'

/**
 * Whether HEAD's `ref:` text names a ref the poll may stat: under `refs/`,
 * plain characters, no `..`, no component ending `.lock`.
 *
 * Git's refname rules, narrowed; anything else is read through git.
 *
 * @param ref the text after `ref: `
 * @returns whether the ref is safe to join under the common directory
 */
export const isSafeRefName = (ref: string) =>
  SAFE_REF_PATTERN.test(ref) &&
  !ref.includes('..') &&
  !ref.split('/').some(part => part.endsWith('.lock'))
