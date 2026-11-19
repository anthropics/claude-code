/**
 * Matched by a schema of an object that says which of its members must be
 * there.
 */
export type SchemaOfRequiredFields<Fields> = {
  properties: Fields
  required: readonly string[]
}
