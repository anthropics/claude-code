import type { EngineInterface } from 'claude-code'

import { pinnedVariableRefusal } from '../pinned-variable-refusal'
import type { createPolicyMemo } from './create-policy-memo'
import { decidedByPolicy } from './decided-by-policy.js'
import { isCloudVariableInUse } from './is-cloud-variable-in-use.js'
import { isPinnedVariable } from './is-pinned-variable.js'
import { SOURCE } from './source.js'

/**
 * Why a person's plugin may not change these variables: one is pinned in
 * every session, or as one of a cloud this session runs on.
 *
 * Never rejects: what cannot be read pins the name. With no name nothing is read.
 *
 * @param $ the calling hook's
 * @param readPolicy the memoized policy read
 * @param names the variables a plugin would set or unset
 * @returns the refusal for the first that is pinned, or undefined
 */
export async function pinnedRefusalOf(
  $: EngineInterface,
  readPolicy: ReturnType<typeof createPolicyMemo>,
  names: readonly string[],
): Promise<string | undefined> {
  for (const name of names) {
    const isPinned =
      (await decidedByPolicy(
        readPolicy(() => $.settings.read(SOURCE)),
        policy => isPinnedVariable(policy, name),
      )) || (await isCloudVariableInUse($, name))

    if (isPinned) {
      return pinnedVariableRefusal(name)
    }
  }

  return undefined
}
