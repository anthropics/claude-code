/**
 * What the engine said of reading one path: `denied` by a Read rule on the
 * path, `closed` when no such rule holds but Read would not read it,
 * `untold` when no tool could say, `unknown` when it failed or was late.
 */
export type ReadVerdict = 'open' | 'denied' | 'closed' | 'untold' | 'unknown'
