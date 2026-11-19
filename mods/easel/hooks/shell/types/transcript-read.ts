import type { FinishedCall } from './finished-call'

/**
 * A fresh read of the main transcript, asked of the host by the hook that
 * draws.
 */
export type TranscriptRead = () => Promise<FinishedCall[]>
