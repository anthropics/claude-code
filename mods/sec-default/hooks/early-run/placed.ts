import type { EngineInterface } from 'claude-code'

const PARTS = 32
const PATH_MAX = 32_767

/**
 * Where a path lands, links followed and a file not there yet included, in
 * one spelling to compare: lower case, `/` between folders. Never rejects.
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
      return placed($, path, PARTS)
    }

    const parts = await shortened($, path)
    const short = parts.length > 1 ? parts.join('/') : `${parts[0]}/`

    return short.length > PATH_MAX
      ? short.toLowerCase()
      : placed($, short, parts.length > PARTS ? 1 : PARTS)
  }

  const stat = await $.fs.stat(path, { resolve: true }).catch(() => undefined)
  const [, folder = '.', name = ''] =
    /^(.*[/\\])?([^/\\]+)[/\\]*$/s.exec(path) ?? []

  if (
    stat?.realPath !== undefined ||
    name === '' ||
    path === '.' ||
    steps === 0
  ) {
    return (stat?.realPath ?? path).replaceAll('\\', '/').toLowerCase()
  }

  const above = (await placed($, folder, steps - 1)).replace(/\/$/, '')

  if (name === '..') {
    return above.replace(/\/[^/]*$/, '')
  }

  return name === '.' ? above : `${above}/${name.toLowerCase()}`
}

// From the root, with `.` and `..` taken by their spelling, as the engine takes them.
async function shortened($: EngineInterface, path: string): Promise<string[]> {
  const here = /^([a-z]:)?[/\\]/i.test(path)
    ? undefined
    : await $.fs.stat('.', { resolve: true }).catch(() => undefined)
  const [root = '', ...rest] = (
    here?.realPath === undefined ? path : `${here.realPath}/${path}`
  ).split(/[/\\]+/)
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
