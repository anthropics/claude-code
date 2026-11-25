import type { TurnFile } from './turn-file'

/**
 * The file edits of one turn: a prompt the person typed through the tool
 * results that followed it, numbered from 1 in transcript order.
 */
export type TurnDiff = {
  index: number
  preview: string
  files: readonly TurnFile[]

  /**
   * How many of its files are left out as read-denied; none when absent.
   */
  deniedCount?: number

  /**
   * How many are left out until answered for; none when absent.
   */
  uncheckedCount?: number
}
