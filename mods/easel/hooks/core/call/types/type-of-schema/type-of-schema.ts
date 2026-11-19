import type { ScalarByJsonType } from '../scalar-by-json-type'
import type { SchemaOfFields } from '../schema-of-fields'
import type { SchemaOfItems } from '../schema-of-items'
import type { SchemaOfOptions } from '../schema-of-options'
import type { SchemaOfRequiredFields } from '../schema-of-required-fields'
import type { SchemaOfScalar } from '../schema-of-scalar'
import type { SchemaOfWords } from '../schema-of-words'

/**
 * A field is optional unless its name is one of the required names.
 */
type ObjectOfSchemas<Fields, RequiredNames> = {
  [Name in keyof Fields]?: TypeOfSchema<Fields[Name]>
} & {
  [Name in keyof Fields & RequiredNames]: TypeOfSchema<Fields[Name]>
}

/**
 * The cases are those that `schemaErrorsAt` tells apart.
 *
 * No schema is two of them, so their order, which differs there, does not
 * matter. An object whose fields the schema does not name is a record of
 * unknown values.
 */
export type TypeOfSchema<Schema> =
  Schema extends SchemaOfWords<infer Word>
    ? Word
    : Schema extends SchemaOfOptions<infer Option>
      ? TypeOfSchema<Option>
      : Schema extends SchemaOfItems<infer Item>
        ? Array<TypeOfSchema<Item>>
        : Schema extends SchemaOfRequiredFields<infer Fields>
          ? ObjectOfSchemas<Fields, Schema['required'][number]>
          : Schema extends SchemaOfFields<infer Fields>
            ? ObjectOfSchemas<Fields, never>
            : Schema extends SchemaOfScalar<
                  infer Type extends keyof ScalarByJsonType
                >
              ? ScalarByJsonType[Type]
              : Record<string, unknown>
