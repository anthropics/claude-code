import { normalSpellingOf } from './normal-spelling-of.js'

/**
 * Whether a path lies strictly inside a directory, by spelling (no links
 * followed), as the engine bounds its nested CLAUDE.md walk.
 *
 * @param path an absolute path
 * @param dir an absolute directory
 * @returns true when `path` is under `dir` and not `dir` itself
 */
export const isBelow = (path: string, dir: string): boolean =>
  normalSpellingOf(path).startsWith(`${normalSpellingOf(dir)}/`)
