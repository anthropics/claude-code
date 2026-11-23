import type { EngineInterface } from 'claude-code'

import type { Call } from './call.js'
import { placed } from './placed.js'
import { writtenPathOf } from './written-path-of.js'

/**
 * The remembered calls a mod's write repeats: those that change the file it
 * lands on, however either spells the path, or may. Never rejects.
 *
 * @param $ the calling hook's
 * @param remembered the calls that were not allowed
 * @param path the path the mod writes
 * @returns the calls to ask the rules about
 */
export async function writeRepeats(
  $: EngineInterface,
  remembered: readonly Call[],
  path: string,
): Promise<Call[]> {
  const real = await placed($, path).catch(() => undefined)
  const places = new Map<string, typeof real>()
  const repeated: Call[] = []

  for (const call of remembered) {
    const theirs = writtenPathOf(call)

    if (theirs === undefined) {
      continue
    }

    const place =
      places.get(theirs) ?? (await placed($, theirs).catch(() => real))
    places.set(theirs, place)

    if (place === real || real === undefined) {
      repeated.push(call)
    }
  }

  return repeated
}
