import type Types from '../types'
import { instantOf } from './instant-of'

/**
 * Every instant in order, each later than the one before.
 *
 * Ends at NaN too: an instant that `Date` cannot hold. A clock change can
 * make an instant no later than the one before, and that one is left out.
 *
 * @param walk where to begin, how far to go each time and where to end
 * @returns the instants, rising
 */
export function stepsAcross(walk: Types.Walk): number[] {
  const { start, step } = walk
  const { fieldIndex } = step.unit
  const instants: number[] = []
  let value = start[fieldIndex] ?? 0
  let ms = instantOf(start, walk)

  while (ms <= walk.untilMs) {
    const isLater = ms > (instants.at(-1) ?? -Infinity)

    if (isLater) {
      instants.push(ms)
    }

    value += step.count
    ms = instantOf(start.with(fieldIndex, value), walk)
  }

  return instants
}
