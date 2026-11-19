/**
 * `2026-W37` and `2026W371`: a year, a week and, optionally, its day.
 */
export const ISO_WEEK_PATTERN =
  /^(?<year>\d{4})-?W(?<week>\d\d)(?:-?(?<weekday>[1-7]))?$/
