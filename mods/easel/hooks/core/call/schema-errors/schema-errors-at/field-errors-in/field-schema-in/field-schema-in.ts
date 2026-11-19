import type Types from '../../../../types'

/**
 * What a field of an object must hold, where the object's schema has a field
 * of that name of its own.
 *
 * @param properties the schema of each field that the object may have
 * @param name the name of a field that was sent
 * @returns the field's schema, or nothing for a name that is no field
 */
export const fieldSchemaIn = (
  properties: Record<string, Types.JsonSchema>,
  name: string,
): Types.JsonSchema | undefined =>
  Object.hasOwn(properties, name) ? properties[name] : undefined
