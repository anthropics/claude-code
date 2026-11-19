import { FORMS } from '../../forms'
import Refusal from '../../refusal'
import { FORMATS } from '../formats'
import Records from '../records'
import type Types from '../types'
import { bucketOf } from './bucket-of'

/**
 * Spells one chart or refusal for the host's log: choices out of closed
 * lists, rounded numbers and flags.
 *
 * @param usage what is told of the chart or refusal
 * @param call what the shell knows of the call it answered
 * @returns the event and its entries
 */
export const logOf = (
  usage: Types.Usage,
  call: Types.ChartedCall,
): Types.ChartLog => ({
  event: 'easel_chart',
  props: {
    outcome: { value: usage.outcome, of: ['drawn', ...Refusal.REFUSAL_CODES] },
    form: { value: usage.form, of: [...Object.keys(FORMS), 'unnamed'] },
    format: { value: usage.format, of: FORMATS },
    data_from: { value: usage.dataFrom, of: Records.DATA_FROM },
    series_bucket: bucketOf(usage.seriesCount),
    point_bucket: bucketOf(usage.pointCount),
    elapsed_ms_bucket: bucketOf(call.elapsedMs),
    is_form_named: usage.isFormNamed,
    has_left_out: usage.hasLeftOut,
    is_form_replaced: usage.isFormReplaced,
    is_asked: call.isAsked,
    is_in_subagent: call.isInSubagent,
    is_on_terminal: call.surfaces.includes('terminal'),
    is_on_app: call.surfaces.some(surface => surface !== 'terminal'),
  },
})
