import Forms from '../../forms'
import Limits from '../limits'
import Records from '../records'
import type { JsonSchema } from '../types/json-schema/json-schema'

/**
 * The model reads every `description`.
 */
export const INPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    data: {
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'object' } }],
      description:
        'Leave it out to chart the tool result just before this call, as it ' +
        'is: do not type a result again. Where it holds several tables, x ' +
        'and y pick the one with those columns. Or the id of an earlier ' +
        'result, as a refusal lists them. Or the table itself, as records or ' +
        'as text, only for numbers no tool returned.',
    },
    x: {
      type: 'string',
      description:
        'the column along the chart: times, or the categories of bars',
    },
    form: {
      enum: ['line', 'columns', 'bars', 'sparks', 'share'],
      description:
        'if left out, a line over times and bars over names. line, columns ' +
        'and sparks need times in x: over names they are drawn as bars. ' +
        'columns stand ' +
        'on zero, one per day, month or other even step. sparks are a ' +
        'small row for each series, on one scale: for many series. bars ' +
        'are horizontal, one per category. share is the parts of a whole ' +
        'as one bar, what a pie shows: its values are summed',
    },
    y: {
      ...Records.COLUMN_NAMES,
      description:
        `the value columns. Lines share a plot where they have ` +
        `one unit and their largest values are within ` +
        `${Forms.MAX_SCALE_RATIO} times of each other, columns only ` +
        `where they stack. ${Forms.MAX_PLOTS} plots at most, and the ` +
        `rest are named`,
    },
    by: {
      ...Records.COLUMN_NAMES,
      description:
        'columns that split the rows into series. With combine and no by, ' +
        'nothing is split',
    },
    combine: {
      enum: ['sum', 'mean', 'max', 'min'],
      description:
        'how rows that share an x, and a series, become one. "sum" also says ' +
        'the values add, which turns on totals and shares, and stacks ' +
        'columns',
    },
    top: {
      type: 'integer',
      minimum: 1,
      description:
        `how many to draw: ${Forms.FORMS.bars.defaultCount} bars if ` +
        `left out and ${Forms.FORMS.bars.maxCount} at most, ` +
        `${Forms.FORMS.line.maxCount} lines at most, ` +
        `${Forms.FORMS.sparks.defaultCount} sparks and ` +
        `${Forms.FORMS.sparks.maxCount} at most, ` +
        `${Forms.FORMS.share.maxCount} parts of a share beside one ` +
        `for the rest, ${Forms.FORMS.columns.maxCount} series of ` +
        `columns where they stack, else ${Forms.MAX_PLOTS}. The ` +
        `largest are kept, largest first, and the rest are ` +
        `counted`,
    },
    unit: {
      type: 'string',
      description:
        'ms, KB, %, $: what bare numbers are in. Values that carry a unit ' +
        'keep it',
    },
    zone: {
      enum: ['utc', 'local'],
      description:
        'the zone that times are shown in, utc if left out. Times that name ' +
        'no zone are shown as written',
    },
    log: {
      type: 'boolean',
      description:
        'a log scale, for lines. Values at or below zero are counted and ' +
        'left out',
    },
    marks: {
      type: 'array',
      maxItems: Limits.MAX_MARKS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['at'],
        properties: {
          at: { type: 'string', description: 'a time, spelled as in x' },
          label: { type: 'string', description: 'short' },
        },
      },
      description:
        `events on a chart over time, ${Limits.MAX_MARKS} at most: a ` +
        `rule and a label each. One outside the times drawn is ` +
        `said instead`,
    },
    title: { type: 'string', description: 'short' },
  },
} as const satisfies JsonSchema
