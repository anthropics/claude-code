import type { Placed } from './placed'

/**
 * Where each piece ends once all are laid one after another along an axis.
 *
 * A size below zero lays them backwards.
 *
 * @param parts the pieces, in order
 * @param sizeOf the size of one piece
 * @param start where the first piece begins
 * @returns each piece with the point where it ends
 */
export function laidEndToEnd<Part>(
  parts: Part[],
  sizeOf: (part: Part) => number,
  start: number,
): Array<Placed<Part>> {
  const placed: Array<Placed<Part>> = []
  let end = start

  for (const part of parts) {
    end += sizeOf(part)
    placed.push({ part, end })
  }

  return placed
}
