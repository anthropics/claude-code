import { INPUT_SCHEMA } from '../input-schema'
import { schemaErrorsAt } from './schema-errors-at'

/**
 * What is wrong with a call, one sentence for each fault, and nothing for a
 * call that the schema allows.
 *
 * @param input the arguments of a call, as the model sent them
 * @returns the faults, each naming the place it is in
 */
export const schemaErrors = (input: unknown): string[] =>
  schemaErrorsAt(input, INPUT_SCHEMA, '')
