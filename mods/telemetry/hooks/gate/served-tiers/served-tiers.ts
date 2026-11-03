/**
 * The tiers `$.telemetry` serves: the plugins bundled in the binary, and the
 * engine itself. A caller seated anywhere else is refused, on every build.
 */
export const SERVED_TIERS: readonly string[] = ['builtin', 'core']
