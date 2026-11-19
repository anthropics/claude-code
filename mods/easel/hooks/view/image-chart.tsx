/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type Types from './types'

/**
 * The picture that the apps show, with a dim note below it when it is the
 * newest of a group of calls.
 *
 * @param options the app's elements, what was drawn and how wide, and the size
 *   of its group of calls
 * @returns the picture and, for a group, its note, in one column
 */
export function imageChart(options: Types.ImageChartOptions): RenderElement {
  const isGrouped = options.callCount > 1

  return (
    <options.elements.Box flexDirection="column">
      <options.elements.Svg
        source={options.chart.svg(options.columns)}
        alt={options.chart.modelText}
      />
      {isGrouped ? (
        <options.elements.Text dimColor>
          {`newest of ${options.callCount} calls: open the group for the rest`}
        </options.elements.Text>
      ) : null}
    </options.elements.Box>
  )
}
