import Scripted from '../scripted'
import { GIT_WORKTREE } from './git-worktree.js'
import { recordingBackendHostOf } from './recording-backend-host-of.js'
import type { RecordingBackendHost } from './recording-backend-host.js'

/**
 * A recording backend host inside a git working tree: `rev-parse` answers
 * the three lines, nothing else is scripted.
 *
 * @returns the host and the programs it ran
 */
export const gitHostOf = (): RecordingBackendHost =>
  recordingBackendHostOf({ 'rev-parse': Scripted.ok(GIT_WORKTREE) })
