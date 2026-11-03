import type { BodyRoom } from '../body-room'

/**
 * A file's hunks as the body draws them: one `Code` source per hunk in
 * order, whether any of a line was left out, and the room after them.
 */
export type CodeBody = {
  sources: readonly string[]
  isTruncated: boolean
  room: BodyRoom
}
