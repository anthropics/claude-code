import type { EngineInterface } from 'claude-code'

import { configFolders, type FirstFolder } from './config-folders.js'
import { BY_NAME, isWindows, placed, shortened } from './placed.js'

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
 * @returns true for such a file, and where a place is not told
 */
export async function isSettingsFile(
  $: EngineInterface,
  path: string,
  first: FirstFolder,
): Promise<boolean> {
  const folders = await configFolders($, first)
  const isWin = await isWindows($, [path, ...folders].join()).catch(() => {})
  const isNamed = (one: string) =>
    BY_NAME.test(one) && !(isWin && /e$/i.test(one))
  const [short, real, ...files] = await Promise.all([
    isWin ? path : shortened($, path).then(parts => parts.join('/')),
    placed($, path),
    ...folders.map(folder => placed($, `${folder}/settings.json`)),
    ...folders.map(folder => placed($, `${folder}/cowork_settings.json`)),
    placed($, '.claude/settings.json'),
    placed($, '.claude/settings.local.json'),
  ]).catch(() => [path, path, path] as const)

  return isNamed(short) || isNamed(real) || files.includes(real)
}
