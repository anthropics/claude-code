import { storedTextOf } from '../../stored-text-of'
import type Types from '../../types'
import { isRowAsKept } from '../is-row-as-kept'

/**
 * A chart call answers with the words of its chart. Where a hook rewrote that
 * answer, the chart would show what the hook took out.
 *
 * @param drawn the chart call as the host draws it
 * @param call the same call as the transcript holds it
 * @returns whether the row shows the answer as it was stored
 */
export function isToldAsDrawn(
  drawn: Types.DrawnRow,
  call: Types.FinishedCall,
): boolean {
  const { row, hasWholeOutput, isOfAnotherCopy } = drawn
  const told = storedTextOf(call.storedResult, call.readText)

  return hasWholeOutput
    ? storedTextOf(row.output) === told
    : call.text === told && (isOfAnotherCopy || isRowAsKept(drawn, call))
}
