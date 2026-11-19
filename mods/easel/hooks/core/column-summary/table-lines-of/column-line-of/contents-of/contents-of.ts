import type Casting from '../../../../casting'
import Lists from '../../../../lists'
import { countIfAny } from './count-if-any'
import { textDetailOf } from './text-detail-of'
import { timesNoteOf } from './times-note-of'

/**
 * The cells of one column counted by kind, each kind with what a call
 * could read it as.
 *
 * @param column the classified cells under one heading
 * @returns a phrase for each kind that has cells
 */
export function contentsOf(column: Casting.Column): string[] {
  const texts = Lists.distinct(column.cellsByKind.get('text') ?? [])
  const numbers = column.cellsByKind.get('number') ?? []

  return [
    ...countIfAny(numbers.length, 'number', timesNoteOf(numbers)),
    ...countIfAny(column.cellsByKind.get('time')?.length ?? 0, 'time'),
    ...countIfAny(texts.length, 'text', textDetailOf(texts)),
  ]
}
