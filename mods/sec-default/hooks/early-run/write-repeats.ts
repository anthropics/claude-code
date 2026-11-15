import type { EngineInterface } from 'claude-code'

import type { Call } from './call.js'
import { placed } from './placed.js'
import { writtenPathOf } from './written-path-of.js'

/**
 * The remembered calls a mod's write repeats: those that change the file it
 * lands on, however either spells the path. Never rejects.
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
  const real = await placed($, path)
  const places = new Map<string, string>()
  const repeated: Call[] = []

  for (const call of remembered) {
    const theirs = writtenPathOf(call)

    if (theirs === undefined) {
      continue
    }

    const place = places.get(theirs) ?? (await placed($, theirs))
    places.set(theirs, place)

    if (place === real) {
      repeated.push(call)
    }
  }

  return repeated
}
