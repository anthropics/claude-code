import type { EngineInterface } from 'claude-code'

/** The config folder as it was first read. */
export type FirstFolder = { folder?: string }

/**
 * Where the session's own settings may sit: as the environment says now, and
 * as it said before a person's mod set a variable. Never rejects.
 *
 * @param $ the calling hook's
 * @param first filled at the first read
 * @returns the folders
 */
export async function configFolders(
  $: EngineInterface,
  first: FirstFolder,
): Promise<string[]> {
  const [configured, home, profile] = await Promise.all([
    $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined),
    $.env.get('HOME').catch(() => undefined),
    $.env.get('USERPROFILE').catch(() => undefined),
  ])
  const folder = configured || `${home ?? profile}/.claude`

  if (configured || home || profile) {
    first.folder ??= folder
  }

  return [...new Set([first.folder ?? folder, folder])]
}
