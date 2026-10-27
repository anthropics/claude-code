import type { Context } from '../../../context'

/**
 * The row's `auth`: the signed-in account's and organization's ids, or
 * undefined when the identity holds neither (an API key, no login).
 *
 * @param identity who the rows are from
 * @returns the ids, or undefined
 */
export function authOf(identity: Context['identity']) {
  const hasEither =
    identity.accountUuid !== undefined ||
    identity.organizationUuid !== undefined

  return hasEither
    ? {
        accountUuid: identity.accountUuid,
        organizationUuid: identity.organizationUuid,
      }
    : undefined
}
