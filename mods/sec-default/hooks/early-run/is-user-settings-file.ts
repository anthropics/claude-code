import type { EngineInterface } from 'claude-code'

import type { FirstFolder } from './config-folders.js'
import { placed } from './placed.js'

/**
 * Whether a write lands where the person's user settings file does, in the
 * config folder as it was first read. Never rejects.
 *
 * @param $ the calling hook's
 * @param path the path as written
 * @param first the config folder as it was first read
 * @returns true for that file, or the file it links to
 */
export async function isUserSettingsFile(
  $: EngineInterface,
  path: string,
  { folder }: FirstFolder,
): Promise<boolean> {
  if (folder === undefined) {
    return false
  }

  const [real, ...files] = await Promise.all([
    placed($, path),
    placed($, `${folder}/settings.json`),
    placed($, `${folder}/cowork_settings.json`),
  ])

  return files.includes(real)
}
