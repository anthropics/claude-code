/**
 * A continuation as the gate's catch is handed it after a failure: going
 * on throws what beneath refused with.
 *
 * @param isCalled whether the failed hook had called next before it failed
 * @returns the continuation
 */
export const failingNext = (isCalled: boolean) =>
  Object.assign(
    () => {
      throw new Error('beneath refused the entry')
    },
    { called: isCalled, error: { kind: 'throw' as const, budget: 0 } },
  )
