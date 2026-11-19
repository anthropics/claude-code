import type { RefusalCode } from '../../refusal'
import Texts from '../../texts'
import type { Usage } from '../../usage'
import Limits from '../limits'
import type Types from '../types'
import { MAX_REFUSAL_LINES } from './max-refusal-lines'

/**
 * The one layout of every refusal: a capped list under "Not drawn.", each row
 * wrapped to what the host leaves, with what runs over indented.
 *
 * @param outcome The code of the fault, for telemetry.
 * @param lines What went wrong, then what the model may pass in its place.
 * @param usage What telemetry is told of the call, but for the code.
 * @returns The refusal the model reads.
 */
export const refuse = (
  outcome: RefusalCode,
  lines: string[],
  usage: Usage,
): Types.RefusedChart => ({
  kind: 'refused',
  modelText: (
    'Not drawn. ' +
    Texts.capped(lines, MAX_REFUSAL_LINES, 'more line').join('\n- ')
  )
    .split('\n')
    .map(line =>
      Texts.wrapText(line, Limits.REFUSAL_WIDTH, Infinity).join('\n  '),
    )
    .join('\n'),
  usage: { ...usage, outcome },
})
