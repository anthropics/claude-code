import type CoreCall from '../../call'
import Charting from '../../charting'
import Layout from '../../layout'
import Raster from '../../raster'
import type Reading from '../../reading'
import Svg from '../../svg'
import type { Usage } from '../../usage'
import Limits from '../limits'
import type Types from '../types'
import { drawnUsageOf } from './drawn-usage-of'
import { wholeColumns } from './whole-columns'

/**
 * Makes the chart's words once and holds its two painters, each of which
 * bounds the width it is passed.
 *
 * @param data The rows as they were read.
 * @param request The chart as the model asked for it.
 * @param usage What telemetry is told of the call so far.
 * @returns The chart, drawn anew by a painter each time a surface asks.
 */
export function drawnChartOf(
  data: Reading.Data,
  request: CoreCall.ChartRequest,
  usage: Usage,
): Types.DrawnChart {
  const chart = Charting.chartOf(data, request)

  return {
    kind: 'chart',
    modelText: Charting.modelTextOf(chart).join('\n'),
    terminalRows: columns =>
      Raster.rasterOf(
        Layout.sceneOf(
          chart,
          Math.max(0, wholeColumns(columns, Limits.MAX_TERMINAL_COLUMNS, 0)),
        ),
      ),
    svg: (columns = Limits.MAX_IMAGE_COLUMNS) =>
      Svg.svgOf(
        Layout.sceneOf(
          chart,
          Math.max(
            Layout.MIN_CHART_COLUMNS,
            wholeColumns(
              columns,
              Limits.MAX_IMAGE_COLUMNS,
              Limits.MAX_IMAGE_COLUMNS,
            ),
          ),
        ),
      ),
    usage: drawnUsageOf(usage, data),
  }
}
