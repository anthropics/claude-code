import Git from '../../git'
import { NO_BODIES } from '../no-bodies'
import type { PaneModel } from '../pane-model'

/**
 * The pane before anything happened: session mode, nothing fetched,
 * nothing picked, no body read, the current source, git's words, docked.
 */
export const INITIAL_MODEL: PaneModel = Object.freeze({
  words: Git.GIT_WORDS,
  baseModes: Git.GIT_BASE_MODES,
  isLoading: false,
  hasSettled: false,
  isOutsideRepository: false,
  data: null,
  requestedMode: 'session',
  selectedPath: null,
  isNoiseShown: false,
  isPreSessionShown: false,
  source: Object.freeze({ kind: 'current' }),
  turns: Object.freeze([]),
  bodies: NO_BODIES,
  todos: Object.freeze({ done: 0, total: 0 }),
  armedPath: null,
  placement: 'dock',
  isFullscreen: null,
  dialogView: 'list',
  place: Object.freeze({ top: 0, listStart: 0, columns: 0, rows: 0 }),
})
