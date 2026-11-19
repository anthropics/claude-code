import type Types from '../types'
import { UNREAD_DATE } from './unread-date'

/**
 * Tells a date that is left unread because its day, month or year is a guess.
 *
 * @param cell what the table holds in one place
 * @returns whether it is such a date
 */
export const isLikeAnUnreadDate = (cell: Types.Cell): boolean =>
  UNREAD_DATE.test(String(cell ?? '').trim())
