/**
 * Makes a call on `$` at once and hands back a promise of what it settles
 * to; a call that throws where it is made rejects that promise.
 *
 * @param call the call, made inside the hook that asked for it
 * @returns what the call settles to
 */
export const attempted = <T>(call: () => T | Promise<T>) =>
  (async () => call())()
