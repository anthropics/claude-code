import type { EngineInterface } from 'claude-code'

import { configFolders, type FirstFolder } from './config-folders.js'
import { placed } from './placed.js'

const BY_NAME =
  /[/\\]\.claude[/\\](settings|settings\.local|cowork_settings)\.json$/i

/**
 * Whether a write lands on a Claude Code settings file that can hold
 * permissions: a person's, a project's or the local one. Never rejects.
 *
 * Told by its name under any `.claude` folder, or by where the session's own
 * files lead, since one may be a link or sit in another config folder.
 *
 * @param $ the calling hook's
 * @param path the path as written
 * @param first the config folder as it was first read
 * @returns true for such a file
 */
export async function isSettingsFile(
  $: EngineInterface,
  path: string,
  first: FirstFolder,
): Promise<boolean> {
  const folders = await configFolders($, first)
  const [real, ...files] = await Promise.all([
    placed($, path),
    ...folders.map(folder => placed($, `${folder}/settings.json`)),
    ...folders.map(folder => placed($, `${folder}/cowork_settings.json`)),
    placed($, '.claude/settings.json'),
    placed($, '.claude/settings.local.json'),
  ])

  return BY_NAME.test(path) || BY_NAME.test(real) || files.includes(real)
}
