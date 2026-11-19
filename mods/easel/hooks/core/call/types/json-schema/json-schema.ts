/**
 * Only the keywords that the tool's schema is written in, which are those
 * that `schemaErrorsAt` checks.
 */
export type JsonSchema = {
  type?: 'object' | 'array' | 'string' | 'integer' | 'boolean'
  enum?: readonly string[]
  properties?: Record<string, JsonSchema>
  required?: readonly string[]
  additionalProperties?: false
  items?: JsonSchema
  maxItems?: number
  anyOf?: readonly JsonSchema[]
  minimum?: number
  description?: string
}
