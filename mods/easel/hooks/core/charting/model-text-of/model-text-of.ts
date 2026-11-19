import { FORMS } from '../../forms'
import Lists from '../../lists'
import Texts from '../../texts'
import Limits from '../limits'
import type Types from '../types'
import Words from '../words'
import { markLineOf } from './mark-line-of'
import { modelNotesOf } from './model-notes-of'
import { quotedTitleOf } from './quoted-title-of'

/**
 * Each line starts with a word or a dash of this plugin, and the title stands
 * in quotes, so that text from the data cannot pose as a line of its own.
 *
 * @param chart the chart to put in words
 * @returns the lines the model reads
 */
export function modelTextOf(chart: Types.Chart): string[] {
  const firstLine = [
    `${FORMS[chart.form].label}` + quotedTitleOf(chart.header),
    ...chart.header.facts,
    `from ${chart.header.source}`,
  ].join(Words.SEPARATOR)
  const rowLines = (
    'plots' in chart ? chart.plots.flatMap(plot => plot.rows) : chart.rows
  ).map(row => {
    const pointCount = 'stretches' in row ? row.stretches.flat().length : 0

    return (
      `- ${row.name}: ` +
      [
        ...row.stats.map(stat => stat.filter(part => part !== '').join(' ')),
        ...(pointCount > 0 ? [Texts.counted(pointCount, 'point')] : []),
      ].join(Words.SEPARATOR)
    )
  })
  const lastLines = [
    ...('plots' in chart ? chart.marks : []).map(mark => markLineOf(mark)),
    ...modelNotesOf(chart).map(note => `note: ${note}`),
  ]

  return [
    firstLine,
    ...Texts.capped(
      rowLines,
      Lists.takeWithin(
        rowLines,
        Limits.MAX_MODEL_TEXT_CHARS -
          [firstLine, ...lastLines].join('\n').length,
        line => line.length + 1,
      ).length,
      'more row',
    ),
    ...lastLines,
  ]
}
