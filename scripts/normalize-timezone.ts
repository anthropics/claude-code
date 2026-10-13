/**
 * Normalize legacy IANA timezone aliases to their canonical names.
 *
 * Some operating systems still report legacy timezone identifiers via
 * `Intl.DateTimeFormat().resolvedOptions().timeZone`. The IANA Time Zone
 * Database renamed several zones over the years — most notably
 * "Europe/Kiev" → "Europe/Kyiv" in tzdata 2022b.
 *
 * This map covers the most common legacy aliases that differ from their
 * canonical IANA names. It is intentionally kept small; extend as needed.
 *
 * Reference: https://data.iana.org/time-zones/tzdb/backward
 *
 * Fixes: https://github.com/anthropics/claude-code/issues/40418
 */

const LEGACY_TIMEZONE_ALIASES: Record<string, string> = {
  "Europe/Kiev": "Europe/Kyiv",
};

/**
 * Return the canonical IANA timezone name for the current environment.
 *
 * Usage (drop-in replacement for raw Intl lookup):
 *
 *   const tz = getCanonicalTimezone();
 *   // "Europe/Kyiv" instead of "Europe/Kiev" on older OS tz databases
 */
export function getCanonicalTimezone(): string {
  const raw = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return LEGACY_TIMEZONE_ALIASES[raw] ?? raw;
}
