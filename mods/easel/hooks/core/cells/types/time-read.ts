import type { NotRead } from './not-read'
import type { TimeFound } from './time-found'

/**
 * Read as UTC where no zone is named. An epoch counts as zoned.
 */
export type TimeRead = TimeFound | NotRead
