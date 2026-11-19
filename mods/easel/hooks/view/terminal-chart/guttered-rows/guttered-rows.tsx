/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import Shapes from '../../../core/shapes'
import Texts from '../../../core/texts'
import Limits from '../../limits'
import type Types from '../../types'
import Words from '../../words'

/**
 * The chart as a person sees it in a terminal: the gutter at the left, then
 * the coloured rows, with the closing lines wrapped and quiet below.
 *
 * @param options the terminal's elements and width, and what was drawn
 * @param footer the lines to put below the chart, if any
 * @returns the gutter beside the coloured rows
 */
export function gutteredRows(
  options: Types.TerminalChartOptions,
  footer: readonly string[],
): RenderElement {
  const width = options.columns - Limits.ROW_INDENT

  return (
    <options.elements.Box flexDirection="row">
      <options.elements.Text dimColor>{Words.GUTTER}</options.elements.Text>
      <options.elements.Text>
        {options.chart
          .terminalRows(width)
          .concat(
            footer
              .flatMap(text => Texts.wrapText(text, width))
              .map(text => [{ text, ink: 'quiet' as const }]),
          )
          .flatMap((row, rowIndex) => [
            rowIndex > 0 ? '\n' : '',
            ...row.map(run => (
              <options.elements.Text
                color={Shapes.PALETTE[run.ink].host}
                backgroundColor={
                  run.background && Shapes.PALETTE[run.background].host
                }
                bold={run.ink === 'title'}
              >
                {run.text}
              </options.elements.Text>
            )),
          ])}
      </options.elements.Text>
    </options.elements.Box>
  )
}
