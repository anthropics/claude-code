import type CoreCall from '../../../call'
import Usage from '../../../usage'
import type Types from '../../types'

/**
 * What telemetry is told of a chart the model asks for, before any of it is
 * read: nothing drawn, the form asked for, and where the data is.
 *
 * @param request The chart as the model asked for it.
 * @param dataFrom Where the text of the data was found.
 * @returns What is told of the asking, with nothing drawn yet.
 */
export const askedUsageOf = (
  request: CoreCall.ChartRequest,
  dataFrom: Types.DrawnChart['usage']['dataFrom'],
): Types.DrawnChart['usage'] => ({
  ...Usage.NOTHING_DRAWN,
  form: request.form ?? 'unnamed',
  isFormNamed: request.form !== undefined,
  dataFrom,
})
