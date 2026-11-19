/**
 * Matched by a schema with an `anyOf`: what meets one of those meets it.
 */
export type SchemaOfOptions<Option> = { anyOf: ReadonlyArray<Option> }
