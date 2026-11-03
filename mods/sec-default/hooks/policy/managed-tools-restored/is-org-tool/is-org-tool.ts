import type { Settings } from 'claude-code'

import { isServerFileUnreadable } from './is-server-file-unreadable'
import { orgPluginNames } from './org-plugin-names'
import { orgServerNames } from './org-server-names'
import { spellingsOf } from './spellings-of'
import { toolPrefixOf } from './tool-prefix-of'
import { foldedName } from './tool-prefix-of/folded-name'

/**
 * Whether a tool is the organization's: `mcp__<name>__...` for a server its
 * policy names or delivers, and a tool under a seated plugin's name or
 * scope (`plugin_<name>`, which holds its own manifest's servers).
 *
 * A server is told by its name whole, as the engine spells it (spellingsOf),
 * never by a fold: another server whose name only begins like it is not it.
 * A seated plugin is told fold to fold, as the registration check tells it
 * (foldedName), since policy may list its id in another letter case. Where
 * the server file cannot be read, every `mcp__` tool counts.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param tool the tool's name, as the model sees it
 * @returns true when the tool is the organization's
 */
export const isOrgTool = (policy: Settings, tool: string): boolean =>
  (isServerFileUnreadable(policy) && tool.startsWith('mcp__')) ||
  orgServerNames(policy)
    .flatMap(spellingsOf)
    .some(spelt => tool.startsWith(`mcp__${spelt}__`)) ||
  orgPluginNames(policy)
    .filter(name => foldedName(name) !== '')
    .flatMap(name => [name, `plugin_${name}`])
    .some(owner => `${foldedName(tool)}_`.startsWith(toolPrefixOf(owner)))
