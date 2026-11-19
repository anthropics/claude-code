import type { INPUT_SCHEMA } from '../input-schema'
import type { TypeOfSchema } from './type-of-schema'

/**
 * A call that passed the schema, which is the only validator: the type of a
 * request derives from it.
 *
 * The schema is one part of the tool's static contract with the model, beside
 * its name, its description and its notes.
 */
export type ChartRequest = TypeOfSchema<typeof INPUT_SCHEMA>
