import Tables from '../../tables'
import { tokenOf } from '../token-of'
import Words from '../words'

/**
 * Every format that telemetry can be told.
 */
export const FORMATS: readonly string[] = [
  ...Tables.KNOWN_SOURCES.map(tokenOf),
  Words.PATH_FORMAT,
  Words.UNREAD_FORMAT,
]
