import Json from '../../../json'
import type Types from '../../types'
import { fieldErrorsIn } from './field-errors-in'
import { jsonTypeOf } from './json-type-of'

/**
 * An array that is too long is not looked into: its length is the one error.
 * An error in a field of an object ends with the field's help.
 *
 * @param value what was sent at this place of the call
 * @param schema what the place must hold
 * @param path where the place is in the call, empty for the call itself
 * @returns the faults found, none where the place holds what it must
 */
export function schemaErrorsAt(
  value: unknown,
  schema: Types.JsonSchema,
  path: string,
): string[] {
  const { anyOf, items, properties, required = [] } = schema
  const isOneOption = anyOf?.some(
    option => schemaErrorsAt(value, option, path).length === 0,
  )

  if (isOneOption) {
    return []
  }

  if (anyOf) {
    return [`${path} must be ${anyOf.map(option => option.type).join(' or ')}`]
  }

  const isWord = schema.enum?.some(word => word === value)

  if (isWord) {
    return []
  }

  if (schema.enum) {
    return [`${path} must be one of ${schema.enum.join(', ')}`]
  }

  const jsonType = jsonTypeOf(value)

  if (schema.type !== jsonType) {
    return [`${path || 'the call'} must be ${schema.type}, not ${jsonType}`]
  }

  const isBelowMinimum =
    typeof value === 'number' && value < (schema.minimum ?? -Infinity)

  if (isBelowMinimum) {
    return [`${path} must be at least ${schema.minimum}`]
  }

  const isTooLong =
    Array.isArray(value) && value.length > (schema.maxItems ?? Infinity)

  if (isTooLong) {
    return [`${path} must hold at most ${schema.maxItems}`]
  }

  const isListOfItems = Array.isArray(value) && items

  if (isListOfItems) {
    return value.flatMap((item, index) =>
      schemaErrorsAt(item, items, `${path}[${index}]`),
    )
  }

  const hasFields = Json.isRecord(value) && properties !== undefined

  if (!hasFields) {
    return []
  }

  const prefix = path === '' ? '' : `${path}.`

  return [
    ...required
      .filter(name => !Object.hasOwn(value, name))
      .map(name => `${prefix}${name} is missing`),
    ...Object.entries(value).flatMap(
      fieldErrorsIn({
        properties,
        prefix,
        fieldNames: Object.keys(properties).join(', '),
        errorsAt: schemaErrorsAt,
      }),
    ),
  ]
}
