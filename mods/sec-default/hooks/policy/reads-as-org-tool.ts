import type { Settings } from 'claude-code'

import { bareNameReadsUnder } from './managed-tools-restored/bare-name-reads-under'
import { isServerFileUnreadable } from './managed-tools-restored/is-org-tool/is-server-file-unreadable'
import { orgNames } from './managed-tools-restored/is-org-tool/org-names'
import { toolPrefixOf } from './managed-tools-restored/is-org-tool/tool-prefix-of'
import { foldedName } from './managed-tools-restored/is-org-tool/tool-prefix-of/folded-name'

/**
 * Whether a tool's whole name reads as the organization's: compared fold to
 * fold with the prefix of each server the policy names, each plugin it seats,
 * and each seated plugin's scope, which holds the servers its own manifest
 * declares. A bare name counts too if it reads as under one of them with its
 * words joined (bareNameReadsUnder).
 *
 * A name of the organization's that folds to nothing cannot be told from any
 * name, and a server file that cannot be read names nobody: every tool then
 * reads as the organization's. The plugin whose engine-recorded id managed
 * enabledPlugins turn on keeps its own name; an unreadable server file holds
 * it all the same.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param name the tool's name, as the model would call it
 * @param id the id the engine recorded for the plugin it would be under, if
 *           it would be under one the mod heard admitted
 * @returns true when the name reads as the organization's
 */
export function readsAsOrgTool(
  policy: Settings,
  name: string,
  id?: string,
): boolean {
  const spelt = `${foldedName(name)}_`

  return (
    isServerFileUnreadable(policy) ||
    orgNames(policy, id).some(
      owner =>
        foldedName(owner) === '' ||
        spelt.startsWith(toolPrefixOf(owner)) ||
        bareNameReadsUnder(name, toolPrefixOf(owner)),
    )
  )
}
