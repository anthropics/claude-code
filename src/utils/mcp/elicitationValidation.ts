import type {
  EnumSchema,
  MultiSelectEnumSchema,
  PrimitiveSchemaDefinition,
  StringSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod/v4'
import { jsonStringify } from '../slowOperations.js'
import { plural } from '../stringUtils.js'
import {
  looksLikeISO8601,
  parseNaturalLanguageDateTime,
} from './dateTimeParser.js'

export type ValidationResult = {
  value?: string | number | boolean
  isValid: boolean
  error?: string
}

const STRING_FORMATS = {
  email: {
    description: 'email address',
    example: 'user@example.com',
  },
  uri: {
    description: 'URI',
    example: 'https://example.com',
  },
  date: {
    description: 'date',
    example: '2024-03-15',
  },
  'date-time': {
    description: 'date-time',
    example: '2024-03-15T14:30:00Z',
  },
}

/**
 * Check if schema is a single-select enum (either legacy `enum` format or new `oneOf` format)
 */
export const isEnumSchema = (
  schema: PrimitiveSchemaDefinition,
): schema is EnumSchema => {
  return schema.type === 'string' && ('enum' in schema || 'oneOf' in schema)
}

/**
 * Check if schema is a multi-select enum (`type: "array"` with `items.enum` or `items.anyOf`)
 */
export function isMultiSelectEnumSchema(
  schema: PrimitiveSchemaDefinition,
): schema is MultiSelectEnumSchema {
  return (
    schema.type === 'array' &&
    'items' in schema &&
    typeof schema.items === 'object' &&
    schema.items !== null &&
    ('enum' in schema.items || 'anyOf' in schema.items)
  )
}

/**
 * Get values from a multi-select enum schema
 */
export function getMultiSelectValues(schema: MultiSelectEnumSchema): string[] {
  if ('anyOf' in schema.items) {
    return schema.items.anyOf.map(item => item.const)
  }
  if ('enum' in schema.items) {
    return schema.items.enum
  }
  return []
}

/**
 * Get display labels from a multi-select enum schema
 */
export function getMultiSelectLabels(schema: MultiSelectEnumSchema): string[] {
  if ('anyOf' in schema.items) {
    return schema.items.anyOf.map(item => item.title)
  }
  if ('enum' in schema.items) {
    return schema.items.enum
  }
  return []
}

/**
 * Get label for a specific value in a multi-select enum
 */
export function getMultiSelectLabel(
  schema: MultiSelectEnumSchema,
  value: string,
): string {
  const index = getMultiSelectValues(schema).indexOf(value)
  return index >= 0 ? (getMultiSelectLabels(schema)[index] ?? value) : value
}

/**
 * Get enum values from EnumSchema (handles both legacy `enum` and new `oneOf` formats)
 */
export function getEnumValues(schema: EnumSchema): string[] {
  if ('oneOf' in schema) {
    return schema.oneOf.map(item => item.const)
  }
  if ('enum' in schema) {
    return schema.enum
  }
  return []
}

/**
 * Get enum display labels from EnumSchema
 */
export function getEnumLabels(schema: EnumSchema): string[] {
  if ('oneOf' in schema) {
    return schema.oneOf.map(item => item.title)
  }
  if ('enum' in schema) {
    return ('enumNames' in schema ? schema.enumNames : undefined) ?? schema.enum
  }
  return []
}

/**
 * Get label for a specific enum value
 */
export function getEnumLabel(schema: EnumSchema, value: string): string {
  const index = getEnumValues(schema).indexOf(value)
  return index >= 0 ? (getEnumLabels(schema)[index] ?? value) : value
}

function getZodSchema(schema: PrimitiveSchemaDefinition): z.ZodTypeAny {
  if (isEnumSchema(schema)) {
    const [first, ...rest] = getEnumValues(schema)
    if (!first) {
      return z.never()
    }
    return z.enum([first, ...rest])
  }
  if (schema.type === 'string') {
    let stringSchema = z.string()
    if (schema.minLength !== undefined) {
      stringSchema = stringSchema.min(schema.minLength, {
        message: `Must be at least ${schema.minLength} ${plural(schema.minLength, 'character')}`,
      })
    }
    if (schema.maxLength !== undefined) {
      stringSchema = stringSchema.max(schema.maxLength, {
        message: `Must be at most ${schema.maxLength} ${plural(schema.maxLength, 'character')}`,
      })
    }
    switch (schema.format) {
      case 'email':
        stringSchema = stringSchema.email({
          message: 'Must be a valid email address, e.g. user@example.com',
        })
        break
      case 'uri':
        stringSchema = stringSchema.url({
          message: 'Must be a valid URI, e.g. https://example.com',
        })
        break
      case 'date':
        stringSchema = stringSchema.date(
          'Must be a valid date, e.g. 2024-03-15, today, next Monday',
        )
        break
      case 'date-time':
        stringSchema = stringSchema.datetime({
          offset: true,
          message:
            'Must be a valid date-time, e.g. 2024-03-15T14:30:00Z, tomorrow at 3pm',
        })
        break
      default:
        // No specific format validation
        break
    }
    return stringSchema
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    const typeLabel = schema.type === 'integer' ? 'an integer' : 'a number'
    const isInteger = schema.type === 'integer'
    const formatNum = (n: number) =>
      Number.isInteger(n) && !isInteger ? `${n}.0` : String(n)

    // Build a single descriptive error message for range violations
    const rangeMsg =
      schema.minimum !== undefined && schema.maximum !== undefined
        ? `Must be ${typeLabel} between ${formatNum(schema.minimum)} and ${formatNum(schema.maximum)}`
        : schema.minimum !== undefined
          ? `Must be ${typeLabel} >= ${formatNum(schema.minimum)}`
          : schema.maximum !== undefined
            ? `Must be ${typeLabel} <= ${formatNum(schema.maximum)}`
            : `Must be ${typeLabel}`

    let numberSchema = z.coerce.number({
      error: rangeMsg,
    })
    if (schema.type === 'integer') {
      numberSchema = numberSchema.int({ message: rangeMsg })
    }
    if (schema.minimum !== undefined) {
      numberSchema = numberSchema.min(schema.minimum, {
        message: rangeMsg,
      })
    }
    if (schema.maximum !== undefined) {
      numberSchema = numberSchema.max(schema.maximum, {
        message: rangeMsg,
      })
    }
    return numberSchema
  }
  if (schema.type === 'boolean') {
    return z.coerce.boolean()
  }

  throw new Error(`Unsupported schema: ${jsonStringify(schema)}`)
}

export function validateElicitationInput(
  stringValue: string,
  schema: PrimitiveSchemaDefinition,
): ValidationResult {
  const zodSchema = getZodSchema(schema)
  const parseResult = zodSchema.safeParse(stringValue)

  if (parseResult.success) {
    // zodSchema always produces primitive types for elicitation
    return {
      value: parseResult.data as string | number | boolean,
      isValid: true,
    }
  }
  return {
    isValid: false,
    error: parseResult.error.issues.map(e => e.message).join('; '),
  }
}

const hasStringFormat = (
  schema: PrimitiveSchemaDefinition,
): schema is StringSchema & { format: string } => {
  return (
    schema.type === 'string' &&
    'format' in schema &&
    typeof schema.format === 'string'
  )
}

/**
 * Returns a helpful placeholder/hint for a given format
 */
export function getFormatHint(
  schema: PrimitiveSchemaDefinition,
): string | undefined {
  if (schema.type === 'string') {
    if (!hasStringFormat(schema)) {
      return undefined
    }

    const { description, example } = STRING_FORMATS[schema.format] || {}
    return `${description}, e.g. ${example}`
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    const isInteger = schema.type === 'integer'
    const formatNum = (n: number) =>
      Number.isInteger(n) && !isInteger ? `${n}.0` : String(n)

    if (schema.minimum !== undefined && schema.maximum !== undefined) {
      return `(${schema.type} between ${formatNum(schema.minimum!)} and ${formatNum(schema.maximum!)})`
    } else if (schema.minimum !== undefined) {
      return `(${schema.type} >= ${formatNum(schema.minimum!)})`
    } else if (schema.maximum !== undefined) {
      return `(${schema.type} <= ${formatNum(schema.maximum!)})`
    } else {
      const example = schema.type === 'integer' ? '42' : '3.14'
      return `(${schema.type}, e.g. ${example})`
    }
  }

  return undefined
}

/**
 * Check if a schema is a date or date-time format that supports NL parsing
 */
export function isDateTimeSchema(
  schema: PrimitiveSchemaDefinition,
): schema is StringSchema & { format: 'date' | 'date-time' } {
  return (
    schema.type === 'string' &&
    'format' in schema &&
    (schema.format === 'date' || schema.format === 'date-time')
  )
}

/**
 * Async validation that attempts NL date/time parsing via Haiku
 * when the input doesn't look like ISO 8601.
 */
export async function validateElicitationInputAsync(
  stringValue: string,
  schema: PrimitiveSchemaDefinition,
  signal: AbortSignal,
): Promise<ValidationResult> {
  const syncResult = validateElicitationInput(stringValue, schema)
  if (syncResult.isValid) {
    return syncResult
  }

  if (isDateTimeSchema(schema) && !looksLikeISO8601(stringValue)) {
    const parseResult = await parseNaturalLanguageDateTime(
      stringValue,
      schema.format,
      signal,
    )

    if (parseResult.success) {
      const validatedParsed = validateElicitationInput(
        parseResult.value,
        schema,
      )
      if (validatedParsed.isValid) {
        return validatedParsed
      }
    }
  }

  return syncResult
}
