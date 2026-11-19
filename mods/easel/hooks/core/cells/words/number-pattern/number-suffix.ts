/**
 * At most one space, a unit with or without a rate, a closing bracket.
 */
export const NUMBER_SUFFIX =
  String.raw`(?<space>\s?)` + String.raw`(?<suffix>[a-zµ%]*(?:\/[a-z]+)?)\)?$`
