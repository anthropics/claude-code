import type { JsonSchema } from '../json-schema'

/**
 * What the check of an object's fields is given once, for all its entries.
 */
export type FieldsToCheck = {
  /**
   * The schema of each field that the object may have.
   */
  properties: Record<string, JsonSchema>

  /**
   * What comes before a field's name in the place of an error.
   */
  prefix: string

  /**
   * The names of all fields of the schema, as one text.
   */
  fieldNames: string

  /**
   * The check of one value against its schema: the same check that reads
   * the object, handed in so that the two do not import each other.
   */
  errorsAt: (value: unknown, schema: JsonSchema, path: string) => string[]
}
