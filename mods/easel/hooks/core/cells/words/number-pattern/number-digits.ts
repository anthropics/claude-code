/**
 * At least one digit, with or without thousands commas and a fraction.
 */
export const NUMBER_DIGITS =
  String.raw`(?=\.?\d)(?<integer>\d{1,3}(?:,\d{3})+|\d+)?` +
  String.raw`(?<fraction>\.\d+)?`
