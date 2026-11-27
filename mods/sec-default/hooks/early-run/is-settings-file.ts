import type { EngineInterface } from 'claude-code'

import { configFolders, type FirstFolder } from './config-folders.js'
import { BY_NAME, fold, isWindows, placed, shortened } from './placed.js'

/**
 * Whether a write lands on a Claude Code settings file that can hold
 * permissions: a person's, a project's or the local one. Never rejects.
 *
 * Told by its name under any `.claude` folder, or by where the session's own
 * files lead, since one may be a link or sit in another config folder. For a
 * remove, a folder above one counts as it, and so does any link where one of
 * them is reached by a link, since no look tells which.
 *
 * @param $ the calling hook's
 * @param path the path as written
 * @param first the config folder as it was first read
 * @param mayTake whether the write may stand for a remove
 * @returns true for such a file, and where a place is not told
 */
export async function isSettingsFile(
  $: EngineInterface,
  path: string,
  first: FirstFolder,
  mayTake = false,
): Promise<boolean> {
  const folders = await configFolders($, first)
  const isWin = await isWindows($, [path, ...folders].join()).catch(() => {})
  const isNamed = (one: string) =>
    BY_NAME.test(fold(one)) && !(isWin && /e$/i.test(one))
  const names = [
    ...folders.map(folder => `${folder}/settings.json`),
    ...folders.map(folder => `${folder}/cowork_settings.json`),
    '.claude/settings.json',
    '.claude/settings.local.json',
  ]
  const [short, real, ...files] = await Promise.all([
    isWin ? path : shortened($, path).then(parts => parts.join('/')),
    placed($, path),
    ...names.map(name => placed($, name)),
  ]).catch(() => [path, path, path] as const)
  const isMoved = async (name: string, nth: number) =>
    !(await shortened($, name))
      .join('/')
      .toLowerCase()
      .endsWith(files[nth] ?? '')
  const isLinkOnTheWay = async () =>
    (await $.fs.stat(path, { resolve: true }).catch(() => {}))?.isLink === true &&
    (await Promise.all(names.map(isMoved)).catch(() => [true])).includes(true)

  return (
    isNamed(short) ||
    isNamed(real) ||
    files.some(file => fold(file) === fold(real)) ||
    (mayTake &&
      (files.some(file => fold(file).startsWith(fold(`${real}/`))) ||
        (await isLinkOnTheWay())))
  )
}
