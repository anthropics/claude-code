import type { EngineInterface } from 'claude-code'

const PARTS = 32
const PATH_MAX = 32_767
const ABSENT =
  /^(\S+: )?(\$\.)?fs\.stat\b(?!.* failed: (DENIED|UNHELD|RULES_MOVED)$)/s
const GONE = /^\S+: \$\.fs\.list(\(.*\))? failed: ENOENT$/s
const DRIVE = /^\S+ \S+ \$\.fs\.stat\(([a-z]:|\\\\)/i
const UNLISTED = /^(\.*|\.claude)$|[^ -~]/i
const STEPPED = /\.claude[/\\](.*[/\\])?\.{0,2}([/\\]|$)/is
export const BY_NAME =
  /(^|[/\\])\.claude([/\\](settings(\.local)?|cowork_settings)\.json)?$/i
export const disk: { isWindows?: boolean } = {}

/**
 * Where a path lands, links followed and a file not there yet included, in
 * one spelling to compare: lower case, `/` between folders. Rejects if untold.
 *
 * A path of more than 32 parts, once its steps back are taken, is walked up one
 * folder at most, and one too long to open is as it is spelled.
 *
 * @param $ the calling hook's
 * @param path absolute, or under the working directory
 * @param steps how many folders it may still be walked up
 * @returns where it lands, and what cannot be resolved as it was given
 */
export async function placed(
  $: EngineInterface,
  path: string,
  steps?: number,
): Promise<string> {
  if (steps === undefined) {
    if (path.split(/[/\\]+/).length <= PARTS) {
      const isStepped = !(await isWindows($, path)) && STEPPED.test(path)
      const named = isStepped && (await shortened($, path)).join('/')

      return placed($, named && BY_NAME.test(named) ? named : path, PARTS)
    }

    const parts = await shortened($, path)
    const short = parts.length > 1 ? parts.join('/') : `${parts[0]}/`

    return short.length > PATH_MAX
      ? short.toLowerCase()
      : placed($, short, parts.length > PARTS ? 1 : PARTS)
  }

  const [, folder = '.', name = ''] =
    /^(.*[/\\])?([^/\\]+)[/\\]*$/s.exec(path) ?? []
  const stat = await looked($, path).catch(async (error: unknown) => {
    // SECURITY: a list stands in only for a plain name, short of where the walk ends.
    if (!steps || UNLISTED.test(name) || /\\[^/\\]*\/*$/.test(path)) {
      throw error
    }

    const isMaybeIt = (one: string) =>
      /[^ -~]/.test(one) || one.toLowerCase() === name.toLowerCase()
    const listed = await $.fs.list(folder).catch((no: unknown) => {
      return GONE.test(Object(no).message) ? [] : Promise.reject(error)
    })

    if (listed.some(one => one.kind === 'other' && isMaybeIt(one.name))) {
      throw error
    }
  })
  // SECURITY: there and absent take the same looks.
  const isNamed = !disk.isWindows && BY_NAME.test(path)
  const up = isNamed && /n$/i.test(name) && (await placed($, folder, 0))

  if (
    stat?.realPath !== undefined ||
    name === '' ||
    path === '.' ||
    steps === 0 ||
    (isNamed && !up)
  ) {
    return (stat?.realPath ?? path).replaceAll('\\', '/').toLowerCase()
  }

  const above = (up || (await placed($, folder, steps - 1))).replace(/\/$/, '')

  if (name === '..') {
    return above.replace(/\/[^/]*$/, '')
  }

  return name === '.' ? above : `${above}/${name.toLowerCase()}`
}

async function looked($: EngineInterface, path: string) {
  const stat = await $.fs.stat(path, { resolve: true }).catch(absent)
  const isUntold = stat?.isLink && !stat.realPath && !stat.size && !stat.mtimeMs

  return isUntold && !disk.isWindows ? untold() : stat
}

const untold = (): Promise<never> => Promise.reject(new Error('not told'))
const absent = (error: unknown) =>
  ABSENT.test(Object(error).message) ? undefined : ({ isLink: true } as never)

// SECURITY: the root says how a path is read. Never a guess.
export async function isWindows($: EngineInterface, path: string) {
  if (disk.isWindows === undefined && /\\|^[a-z]:|^\/\//i.test(path)) {
    const top = await $.fs.stat('/', { resolve: true }).catch(String)
    const real = Object(top).realPath || DRIVE.exec(String(top))?.[1]
    disk.isWindows = (real || (await untold()))[0] !== '/'
  }

  return disk.isWindows
}

// From the root, with `.` and `..` taken by their spelling, as the engine takes them.
export async function shortened($: EngineInterface, path: string) {
  const isWin = await isWindows($, path)
  const isRooted = (isWin ? /^([a-z]:)?[/\\]/i : /^\//).test(path)
  const here = isRooted ? undefined : await looked($, '.')
  const [root = '', ...rest] = (
    here?.realPath === undefined ? path : `${here.realPath}/${path}`
  ).split(isWin || /^[^/]/.test(here?.realPath ?? '') ? /[/\\]+/ : /\/+/)
  const parts = [root]

  for (const part of rest) {
    if (part === '..') {
      parts.length = Math.max(1, parts.length - 1)
    } else if (part !== '.' && part !== '') {
      parts.push(part)
    }
  }

  return parts
}
