import type CoreCall from '../../../../call'

/**
 * Every column that a call names, on either axis or to split by.
 *
 * @param request the chart that was asked for
 * @returns the names, those of the time axis first
 */
export const namesOf = (request: CoreCall.ChartRequest): string[] =>
  [request.x ?? [], request.y ?? [], request.by ?? []].flat()
