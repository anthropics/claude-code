import type Types from '../types'
import Words from '../words'

/**
 * A crash. Each refusal starts from it and states its own outcome.
 */
export const NOTHING_DRAWN: Types.Usage = {
  outcome: 'failed',
  form: 'unnamed',
  isFormNamed: false,
  format: Words.UNREAD_FORMAT,
  dataFrom: 'none',
  seriesCount: 0,
  pointCount: 0,
  hasLeftOut: false,
  isFormReplaced: false,
}
