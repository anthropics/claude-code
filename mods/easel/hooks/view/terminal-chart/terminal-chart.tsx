/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type Types from '../types'
import { footerOf } from './footer-of'
import { gutteredRows } from './guttered-rows'

/**
 * One of the three element trees that the hooks return. It gets finished text
 * and coloured runs, and never sees the data that was drawn.
 *
 * The host defines `h` and `Fragment` as globals of every hooks module.
 *
 * @param options the terminal's elements and width, what was drawn, whether
 *   for a screen reader, and how many calls an auto chart is the newest of
 * @returns the gutter beside the coloured rows, or the plain words
 */
export function terminalChart(
  options: Types.TerminalChartOptions,
): RenderElement {
  const footer = footerOf(options.autoCallCount)

  return options.isScreenReader ? (
    <options.elements.Text>
      {[options.chart.modelText, ...footer].join('\n')}
    </options.elements.Text>
  ) : (
    gutteredRows(options, footer)
  )
}
