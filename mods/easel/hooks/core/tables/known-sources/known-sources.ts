import Wire from '../../wire'
import { DELIMITERS } from '../delimiters'
import Words from '../words'

/**
 * Every source that a table can carry before `NO_HEADER` ends it: words of
 * this plugin, never of the data.
 */
export const KNOWN_SOURCES: readonly string[] = [
  ...DELIMITERS.map(delimiter => delimiter.source),
  Words.ALIGNED_SOURCE,
  Words.LISTED_SOURCE,
  Words.JSON_SOURCE,
  Words.JSON_LINES_SOURCE,
  Words.XML_SOURCE,
  ...Wire.METRIC_SOURCES,
]
