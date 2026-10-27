import Limits from '../../limits'
import { WIDTH_BUCKETS } from '../width-buckets'

/**
 * The bucket a terminal width falls in, the built-in panel's own buckets.
 *
 * @param columns the terminal's width, or null when no render told it yet
 * @returns one of WIDTH_BUCKETS
 */
export function widthBucketOf(
  columns: number | null,
): (typeof WIDTH_BUCKETS)[number] {
  const [narrow, medium, wide, widest] = WIDTH_BUCKETS
  const width = columns ?? 0

  const isNarrow = width < Limits.OPEN_MIN_COLUMNS
  const isMedium = width < Limits.AUTO_OPEN_MIN_COLUMNS
  const isWide = width < Limits.WIDEST_BUCKET_COLUMNS

  return isNarrow ? narrow : isMedium ? medium : isWide ? wide : widest
}
