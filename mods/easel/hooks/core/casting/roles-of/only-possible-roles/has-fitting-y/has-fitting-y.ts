import type Types from '../../../types'

/**
 * Whether the measures fit the form: bars take one, any other form takes
 * one or more.
 *
 * @param yColumns the number columns left as measures
 * @param chosenForm the form the roles are read for
 * @returns whether the form can draw them
 */
export const hasFittingY = (
  yColumns: Types.Column[],
  chosenForm: Types.Roles['form'],
): boolean =>
  chosenForm === 'bars' ? yColumns.length === 1 : yColumns.length >= 1
