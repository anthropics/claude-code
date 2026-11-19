import { schemaErrors } from './schema-errors'
import type Types from './types'

/**
 * Whether the schema allows a call, which is what gives the call its type.
 *
 * @param input the arguments of a call, as the model sent them
 * @returns true where the call has no fault
 */
export const isChartRequest = (input: unknown): input is Types.ChartRequest =>
  schemaErrors(input).length === 0
