/**
 * How long one policy read serves the decisions after it: a burst of
 * `$.tool.list` and `$.tool.register` calls reads once.
 *
 * A settings change waits this long to be seen.
 */
export const POLICY_MEMO_MS = 500
