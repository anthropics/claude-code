/**
 * Every code of a refusal: a word for telemetry and nothing else.
 *
 * With `drawn` they are one choice of the usage that is logged, which the
 * host caps at 32.
 */
export const REFUSAL_CODES = [
  'bad_call',
  'no_result',
  'data_not_found',
  'too_long',
  'cut_short',
  'no_table_read',
  'table_unpicked',
  'no_rows',
  'names_repeat',
  'dates_unread',
  'few_times',
  'no_numbers',
  'no_x',
  'no_y',
  'no_such_column',
  'units_mixed',
  'units_differ',
  'zones_mixed',
  'x_not_times',
  'column_unread',
  'rows_share_x',
  'no_values',
  'bars_partly_unread',
  'share_not_summed',
  'share_not_whole',
  'log_not_line',
  'uneven_step',
  'column_below_zero',
  'failed',
] as const
