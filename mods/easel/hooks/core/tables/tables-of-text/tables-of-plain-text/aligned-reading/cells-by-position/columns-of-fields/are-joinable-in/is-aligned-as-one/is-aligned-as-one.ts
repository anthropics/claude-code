/**
 * A cell holds no two spaces in a row.
 *
 * The cells of a column line up on one side, under one stroke of a rule.
 *
 * @param texts what the lines of cells hold in a span of two fields
 * @param ruleTexts what the rules hold in that span
 * @returns whether the span can hold the cells of one column
 */
export const isAlignedAsOne = (texts: string[], ruleTexts: string[]): boolean =>
  !ruleTexts.some(rule => rule.trim().includes(' ')) &&
  !texts.some(text => text.trim().includes('  ')) &&
  (!texts.some(text => /^ +\S/.test(text)) ||
    !texts.some(text => /\S +$/.test(text)))
