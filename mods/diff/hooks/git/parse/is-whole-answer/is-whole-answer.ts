import type Types from '../../types'
import { isWholeListing } from '../is-whole-listing'

/**
 * Whether a `-z` git child both succeeded and answered a whole listing,
 * so its stdout may be parsed (isWholeListing).
 *
 * @param result what the child left
 * @returns whether to parse it
 */
export const isWholeAnswer = (result: Types.RunResult) =>
  result.exitCode === 0 && isWholeListing(result.stdout)
