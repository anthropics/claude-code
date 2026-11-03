/**
 * The row's `platform` as the CLI's own rows have it: the host platform the
 * environment names when it is one of the three, else by the system's name.
 *
 * @param hostPlatform CLAUDE_CODE_HOST_PLATFORM, when set
 * @param platformRaw the system's own name lowercased
 * @returns `win32`, `darwin`, or `linux` for anything else
 */
export function platformOf(
  hostPlatform: string | undefined,
  platformRaw: string,
) {
  const named = ['win32', 'darwin', 'linux'].find(one => one === hostPlatform)
  const isOwnName = platformRaw === 'win32' || platformRaw === 'darwin'

  return named ?? (isOwnName ? platformRaw : 'linux')
}
