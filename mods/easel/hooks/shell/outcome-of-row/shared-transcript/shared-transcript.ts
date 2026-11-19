import type Types from '../../types'

/**
 * A caller that did not find its call in a read passes that read along.
 *
 * If it is still the one held, a new read takes its place. If not, another
 * caller has started a newer read, and that one is joined. A read that fails is
 * forgotten.
 *
 * @param readTranscript reads the main transcript afresh from the host
 * @param cache where the read of the main transcript is kept
 * @param seenRead the read that lacked the caller's call, if any
 * @returns the read to look in, shared with the other callers
 */
export function sharedTranscript(
  readTranscript: Types.TranscriptRead,
  cache: Types.ChartCache,
  seenRead?: Promise<Types.FinishedCall[]>,
): Promise<Types.FinishedCall[]> {
  if (cache.transcript && cache.transcript !== seenRead) {
    return cache.transcript
  }

  const transcript = readTranscript()
  cache.transcript = transcript

  transcript.catch(() => {
    if (cache.transcript === transcript) {
      cache.transcript = undefined
    }
  })

  return transcript
}
