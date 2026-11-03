import type { Settings } from 'claude-code'

import { isServerFileUnreadable } from './managed-tools-restored/is-org-tool/is-server-file-unreadable'
import { orgNames } from './managed-tools-restored/is-org-tool/org-names'
import { toolPrefixOf } from './managed-tools-restored/is-org-tool/tool-prefix-of'
import { foldedName } from './managed-tools-restored/is-org-tool/tool-prefix-of/folded-name'

/**
 * Whether the tool a plugin registers would read as the organization's: it
 * is called `mcp__<plugin>__<tool>`, compared fold to fold with the prefix
 * of each server the policy names, each plugin it seats, and each seated
 * plugin's scope, which holds the servers its own manifest declares.
 *
 * So a plugin named as one of them in any case or with other separators, one
 * whose name and tool together spell a prefix, and one whose tool's own name
 * folds to nothing all count. A name of the organization's that folds to
 * nothing cannot be told from any name, and a server file that cannot be
 * read names nobody: every registration then reads as the organization's.
 * The plugin whose engine-recorded id managed enabledPlugins turn on keeps
 * its own name; an unreadable server file holds it all the same.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param plugin the registering plugin's name
 * @param tool the tool's own name, as the plugin registers it
 * @param id the id the engine recorded for the registering plugin
 *           (`<name>@<source>`), where the mod heard its admission
 * @returns true when the tool would read as the organization's
 */
export function namesOrgTool(
  policy: Settings,
  plugin: string,
  tool: string,
  id?: string,
): boolean {
  const registered = `${foldedName(`mcp__${plugin}__${tool}`)}_`

  return (
    isServerFileUnreadable(policy) ||
    orgNames(policy, id).some(
      owner =>
        foldedName(owner) === '' || registered.startsWith(toolPrefixOf(owner)),
    )
  )
}
