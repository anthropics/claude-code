/**
 * `Z`, `UTC`, `GMT` or an offset such as `+02:00`, after at most one space.
 */
export const ZONE_PATTERN =
  String.raw`\s?(?<zone>Z|UTC|GMT|[-+]\d\d(?::?\d\d)?)` + String.raw`(?: UTC)?`
