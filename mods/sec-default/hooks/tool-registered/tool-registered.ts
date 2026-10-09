import { TOOL_REGISTER_REFUSAL } from '../tool-register-refusal'
import type Types from './types'

/**
 * What the `tool.register` hook decides, by the caller's tier and the
 * organization's MCP allowlist.
 *
 * An organization's registration continues past the user tier; a person's
 * plugin is refused by name under an allowlist; every other passes.
 *
 * @param e the tool being added
 * @param next the hook's own continuation, with the caller's origin
 * @param isAllowlisted whether managed settings hold an MCP allowlist,
 * asked only for a caller in the user tier; it fails closed
 * @returns the registration's answer
 */
export async function toolRegistered<E, R>(
  e: E,
  next: Types.RegisterNext<E, R>,
  isAllowlisted: () => Promise<boolean>,
) {
  const isOrgs = next.origin.tier === 'prepend' || next.origin.tier === 'append'

  if (isOrgs) {
    return next.to(e, 'append')
  }

  const isRefused = next.origin.tier === 'user' && (await isAllowlisted())

  return isRefused ? { deny: TOOL_REGISTER_REFUSAL } : next(e)
}
