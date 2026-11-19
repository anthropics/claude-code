import type Refusal from '../../../refusal'

/**
 * Words the want of any text to read: no tool has answered, or what was
 * passed names no answer and holds no table.
 *
 * @param isLatestMeant Whether the latest tool result was to be read.
 * @returns The code for telemetry and the reason the model reads.
 */
export const noTextProblem = (isLatestMeant: boolean): Refusal.Problem =>
  isLatestMeant
    ? {
        code: 'no_result',
        why: 'No tool has answered yet. Pass the rows as data',
      }
    : {
        code: 'data_not_found',
        why:
          'data is neither the id of a tool result nor a table. Pass an ' +
          'id, JSON records, or the text of a CSV, TSV or markdown table',
      }
