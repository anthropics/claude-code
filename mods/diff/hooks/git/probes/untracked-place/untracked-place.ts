import type Types from '../../types'

/**
 * How much untrackedFiles may keep: the row slots left under MAX_FILES, and
 * which files count.
 */
export type UntrackedPlace = {
  slots: number
  scope: Types.UntrackedScope
}
