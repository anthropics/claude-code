import type { EngineInterface } from 'claude-code'

const NAME = /settings(\.local)?\.json/i
const UNDER_CLAUDE =
  /\.claude\/(settings|settings\.local|cowork_settings)\.json/

/**
 * Whether a text about to be run names a Claude Code settings file: under a
 * `.claude` folder, or in the session's config folder, by its path or by its
 * variable. Never rejects.
 *
 * @param $ the calling hook's
 * @param texts a process's argv and stdin, or what a call hands its tool
 * @param served the commands of the allowed calls under way, which pass
 * @returns true where one does
 */
export async function namesSettingsFile(
  $: EngineInterface,
  texts: readonly string[],
  served: readonly string[],
): Promise<boolean> {
  const naming = texts
    .filter(text => NAME.test(text) && !served.includes(text))
    .map(plain)

  if (naming.length === 0) {
    return false
  }

  const folder = await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)
  const files = folder
    ? ['settings.json', 'cowork_settings.json'].map(name =>
        plain(`${folder}/${name}`),
      )
    : []

  return naming.some(
    text =>
      UNDER_CLAUDE.test(text) ||
      text.includes('claude_config_dir') ||
      files.some(file => text.includes(file)),
  )
}

const plain = (text: string): string =>
  text.replace(/[/\\]+/g, '/').toLowerCase()
