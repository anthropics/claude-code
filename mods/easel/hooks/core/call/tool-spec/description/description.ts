import Cells from '../../../cells'

/**
 * What the model reads of the tool before it calls it, word for word.
 */
export const DESCRIPTION =
  'Draws one chart from data you already have, and answers with what was ' +
  'read, drawn and left out. The person sees the chart, not this answer: ' +
  'tell them the headline number and pass on the "note:" lines.\n' +
  'The data is a table under 64 KiB: JSON records, CSV, TSV, a markdown or ' +
  'SQL table, aligned shell output. Name x and y. You may leave them out ' +
  'where there is one way to read it: metric results from Prometheus, ' +
  'Grafana and Datadog (these may be charted unasked), one column of times ' +
  'beside nothing but numbers, or beside one column of names too where the ' +
  'times repeat, or one column of names beside one of numbers (bars). ' +
  'Nothing is guessed: a call that leaves a choice open is refused with the ' +
  'columns that were found, so call again. Rows are not counted or put in ' +
  `buckets of time: pass counts. ${Cells.TIME_SPELLINGS}.\n` +
  'It reads no file, and no result that the host cut or saved to a file: ' +
  'query less. A file that a tool read comes with a number before each ' +
  'line: pass its rows as data, without the numbers.'
