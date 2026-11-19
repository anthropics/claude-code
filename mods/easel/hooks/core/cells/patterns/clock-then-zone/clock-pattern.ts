/**
 * Hours and minutes, then optional seconds with an optional fraction.
 */
export const CLOCK_PATTERN =
  String.raw`(?<hour>\d\d):(?<minute>\d\d)` +
  String.raw`(?::(?<second>\d\d)(?<fraction>\.\d+)?)?`
