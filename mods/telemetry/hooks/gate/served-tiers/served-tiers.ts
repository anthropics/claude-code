/**
 * The tiers served a row or a mark: the plugins bundled in the binary, and the
 * engine itself. A caller seated anywhere else is served only as official.
 */
export const SERVED_TIERS: readonly string[] = ['builtin', 'core']
