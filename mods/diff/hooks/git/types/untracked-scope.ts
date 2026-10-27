/**
 * Which untracked files a fetch keeps: the session's own, or those and the
 * ones that predate it, tagged (session mode).
 */
export type UntrackedScope = 'session-only' | 'with-pre-session'
