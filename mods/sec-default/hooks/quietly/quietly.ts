import { attempted } from '../attempted'

/**
 * Makes a call on `$` whose outcome nothing depends on (a line logged): a
 * throw or a rejection ends there.
 *
 * @param call the call, made inside the hook that asked for it
 * @returns nothing
 */
export const quietly = (call: () => unknown) =>
  void attempted(call).catch(() => undefined)
