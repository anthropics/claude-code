import Texts from '../../../../texts'
import Limits from '../../../limits'
import type Types from '../../../types'
import { fieldSchemaIn } from './field-schema-in'

/**
 * What is wrong with one field that an object was sent with, as a step over
 * the object's entries.
 *
 * An error in a field that the schema has ends with the field's help. A name
 * that is no field is the one error, with the names that are.
 *
 * @param fields the schemas, the place, the names and the check of a value
 * @returns the faults of one entry, given its name and its value
 */
export const fieldErrorsIn =
  (fields: Types.FieldsToCheck) =>
  ([name, fieldValue]: [string, unknown]): string[] => {
    const fieldSchema = fieldSchemaIn(fields.properties, name)

    return fieldSchema
      ? fields
          .errorsAt(fieldValue, fieldSchema, `${fields.prefix}${name}`)
          .map(error => `${error} (${fieldSchema.description})`)
      : [
          fields.prefix +
            Texts.cleanLabel(name, Limits.MAX_FIELD_NAME_WIDTH) +
            ` is not a field: those are ${fields.fieldNames}`,
        ]
  }
