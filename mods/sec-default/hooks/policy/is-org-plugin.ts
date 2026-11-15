import type { Settings } from 'claude-code'

import {
  foldedId,
  isEnabledEntry,
} from './managed-tools-restored/is-org-tool/org-plugin-names'

/**
 * Whether managed policy names a plugin as the organization's: enabledPlugins
 * turns it on (isEnabledEntry), or prependPlugins or appendPlugins lists it.
 *
 * Whole ids alone, compared as the engine compares them (foldedId).
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param id the id the engine recorded for the plugin (`<name>@<source>`)
 * @returns true when policy names that id
 */
export function isOrgPlugin(policy: Settings, id: string): boolean {
  const enabled = Object.entries(policy.enabledPlugins ?? {}).flatMap(
    ([key, value]) => (isEnabledEntry(value) ? [key] : []),
  )

  return [enabled, policy.prependPlugins, policy.appendPlugins].some(
    (listed: unknown) =>
      Array.isArray(listed) &&
      listed.some(
        (one: unknown) =>
          typeof one === 'string' && foldedId(one) === foldedId(id),
      ),
  )
}
