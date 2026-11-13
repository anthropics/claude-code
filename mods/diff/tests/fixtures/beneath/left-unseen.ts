import type { ResultOf } from 'claude-code'

/**
 * What an engine answers an open it keeps where nothing is attached to draw
 * it yet: a host whose page has not attached, or one that never draws.
 */
export const LEFT_UNSEEN: ResultOf['ui.open'] = {
  value: {
    isPlaced: false,
    reason:
      'no-surface: no surface is attached ($.session.surfaces() is empty)',
  },
}
