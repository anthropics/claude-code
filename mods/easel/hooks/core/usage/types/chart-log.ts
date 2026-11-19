import type { ChartLogProps } from './chart-log-props'

/**
 * The event of one chart or refusal, as the host's log takes it.
 */
export type ChartLog = {
  /**
   * The name of the event.
   */
  event: 'easel_chart'

  /**
   * Its entries.
   */
  props: ChartLogProps
}
