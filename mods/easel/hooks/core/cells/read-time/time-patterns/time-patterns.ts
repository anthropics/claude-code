import { CLOCK_THEN_ZONE } from './clock-then-zone'

/**
 * `2026-09-14T17:05:09Z` and any shorter start of it; `Mon, 14 Sep 2026 17:05`;
 * `September 14, 2026 17:05`; `20260914T170509Z`.
 */
export const TIME_PATTERNS: readonly RegExp[] = [
  String.raw`^(?<year>\d{4})(?:[-/](?<month>\d\d)(?:[-/](?<day>\d\d)` +
    String.raw`(?:[T ]${CLOCK_THEN_ZONE})?)?)?$`,
  String.raw`^(?:[A-Z][a-z]{2}, )?(?<day>\d{1,2}) ` +
    String.raw`(?<monthName>[A-Z][a-z]+) (?<year>\d{4})` +
    String.raw`(?: ${CLOCK_THEN_ZONE})?$`,
  String.raw`^(?<monthName>[A-Z][a-z]+) (?<day>\d{1,2}), (?<year>\d{4})` +
    String.raw`(?: ${CLOCK_THEN_ZONE})?$`,
  String.raw`^(?<year>\d{4})(?<month>\d\d)(?<day>\d\d)T` +
    String.raw`(?<hour>\d\d)(?<minute>\d\d)(?<second>\d\d)(?<zone>Z)$`,
].map(source => new RegExp(source))
