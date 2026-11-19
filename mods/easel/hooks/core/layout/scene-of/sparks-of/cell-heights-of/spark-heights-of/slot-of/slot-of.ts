/**
 * Finds the slot that a time falls in, for a lane of some count of slots.
 *
 * @param slotCount the slots that the lane has
 * @returns from a time, as a share of the lane, to the index of its slot
 */
export const slotOf =
  (slotCount: number) =>
  (time: number): number =>
    Math.min(slotCount - 1, Math.floor(time * slotCount))
