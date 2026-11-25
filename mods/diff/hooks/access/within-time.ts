import type { Host } from '../host'
import Limits from '../limits'

/**
 * What `work` resolves to within CHECK_TIMEOUT_MS; `late` past it, when it
 * rejects, and when the timer cannot be set.
 *
 * @param engine the bound host's timer
 * @param work the work under way
 * @param late the answer that stands in
 * @returns the answer
 */
export function withinTime<T>(
  engine: Pick<Host, 'after'>,
  work: Promise<T>,
  late: T,
): Promise<T> {
  const answered = work.catch(() => late)

  return new Promise<T>(resolve => {
    const timer = engine.after(Limits.CHECK_TIMEOUT_MS, () => resolve(late))

    void answered.then(answer => {
      resolve(answer)
      timer.cancel()
    })
  }).catch(() => late)
}
