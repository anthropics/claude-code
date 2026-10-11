import type { Settings } from 'claude-code'

import { foldedId } from './folded-id.js'
import { formsOf } from './forms-of.js'
import { isEnabledEntry } from './is-enabled-entry.js'
import { nameOfId } from './name-of-id.js'

/**
 * The names of the plugins the organization itself seats, as their tools
 * are prefixed: an id's name half (nameOfId), in each form the engine may
 * spell it from (formsOf).
 *
 * Those are the ids of prependPlugins and appendPlugins, and every id
 * managed enabledPlugins turns on (isEnabledEntry) but a built-in's, which
 * the engine names.
 *
 * The asking plugin's own id is left out, in every list, exactly when it is
 * one managed enabledPlugins turns on: its name is then its own to use.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param own the id the engine recorded for the plugin that asks for itself
 *            (`<name>@<source>`), compared as the engine compares ids
 * @returns each such plugin's name, in each form; none where no key names
 *          one
 */
export function orgPluginNames(policy: Settings, own?: string): string[] {
  const enabled = Object.entries(policy.enabledPlugins ?? {}).flatMap(
    ([id, value]) =>
      isEnabledEntry(value) && !id.endsWith('@builtin') ? [id] : [],
  )
  const isOwn = (id: string) =>
    typeof own === 'string' && foldedId(id) === foldedId(own)
  const isExempt = enabled.some(isOwn)

  return [policy.prependPlugins, policy.appendPlugins, enabled].flatMap(
    (listed: unknown) =>
      (Array.isArray(listed) ? listed : []).flatMap((id: unknown) => {
        const name = typeof id === 'string' ? nameOfId(id) : ''
        const isLeftOut = typeof id === 'string' && isExempt && isOwn(id)

        return name !== '' && !isLeftOut ? formsOf(name) : []
      }),
  )
}
