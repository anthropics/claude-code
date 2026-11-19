/**
 * Matched by a schema with an `enum`: what it allows is one of those listed.
 */
export type SchemaOfWords<Word> = { enum: ReadonlyArray<Word> }
