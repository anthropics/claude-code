import Lists from '../../lists'
import { checkedMagnitude } from '../checked-magnitude'
import Limits from '../limits'
import Patterns from '../patterns'
import type Types from '../types'
import { UNIT_SUFFIXES } from '../unit-suffixes'
import { unread } from '../unread'
import { COMPOUND_SECONDS } from './compound-seconds'
import { numberInGroups } from './number-in-groups'
import { NUMBER_PATTERN } from './number-pattern'

/**
 * A word glued to the digits is a unit only if it is a known suffix: `5xx` is
 * a name, unless the call declares the column numeric (`250m`).
 *
 * @param cell what the table holds in one place
 * @param isDeclaredNumeric whether the column was declared to hold numbers
 * @returns the number with its base unit, a gap, or why it is not read
 */
export function readNumber(
  cell: Types.Cell,
  isDeclaredNumeric = false,
): Types.NumberRead {
  const isNumber = typeof cell === 'number'

  if (isNumber) {
    return checkedMagnitude(cell, '')
  }

  const text = String(cell ?? '').trim()
  const isEmpty = Patterns.EMPTY_CELL.test(text)

  if (isEmpty) {
    return { kind: 'empty', why: 'empty' }
  }

  const compound: Types.MatchGroups =
    Patterns.COMPOUND_DURATION.exec(text)?.groups ?? {}
  const compoundParts = Object.entries(COMPOUND_SECONDS)
    .filter(([group]) => compound[group] !== undefined)
    .map(([group, seconds]) => Number(compound[group]) * seconds)
  const isCompound = compoundParts.length >= Limits.MIN_COMPOUND_PARTS

  if (isCompound) {
    return checkedMagnitude(Lists.sumOf(compoundParts), 's')
  }

  const groups: Types.MatchGroups | undefined =
    NUMBER_PATTERN.exec(text)?.groups

  if (!groups) {
    return unread('not a number')
  }

  const [gluedWord = ''] = (groups.suffix ?? '').split('/')
  const isUnknownGluedWord =
    groups.space === '' &&
    !isDeclaredNumeric &&
    gluedWord !== '' &&
    !UNIT_SUFFIXES.has(gluedWord)

  return isUnknownGluedWord ? unread('not a number') : numberInGroups(groups)
}
