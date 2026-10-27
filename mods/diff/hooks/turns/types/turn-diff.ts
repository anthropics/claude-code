import type { TurnFile } from './turn-file'

/**
 * The file edits of one turn: a prompt the person typed through the tool
 * results that followed it, numbered from 1 in transcript order.
 */
export type TurnDiff = {
  index: number
  preview: string
  files: readonly TurnFile[]
}
