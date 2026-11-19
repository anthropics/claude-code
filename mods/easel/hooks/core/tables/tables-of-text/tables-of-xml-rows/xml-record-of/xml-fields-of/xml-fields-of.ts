import type Cells from '../../../../../cells'
import Patterns from '../../../../patterns'
import { unescapedXml } from './unescaped-xml'

/**
 * A field marked null holds no value, and an empty one holds an empty text.
 *
 * @param rest the text that follows the start of a field
 * @returns the field's name and cell, or nothing where it does not close
 */
export function xmlFieldsOf(rest: string): [string, Cells.Cell][] {
  const groups = Patterns.XML_FIELD_REST.exec(rest)?.groups
  const isField = groups !== undefined

  return isField
    ? [
        [
          unescapedXml(groups.name ?? ''),
          Patterns.XML_NULL.test(groups.attributes ?? '')
            ? null
            : unescapedXml(groups.text ?? ''),
        ],
      ]
    : []
}
