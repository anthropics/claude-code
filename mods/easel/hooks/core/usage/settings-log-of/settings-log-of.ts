import Records from '../records'
import type Types from '../types'

/**
 * Which servers are skipped is not told: their names are the user's.
 *
 * @param autoCharts what the user changed about charts that nobody asks for
 * @returns the event and its one entry
 */
export const settingsLogOf = (
  autoCharts: (typeof Records.AUTO_CHARTS)[number],
): Types.SettingsLog => ({
  event: 'easel_settings',
  props: { auto_charts: { value: autoCharts, of: Records.AUTO_CHARTS } },
})
