import type { SettingsLogProps } from './settings-log-props'

/**
 * The event of a changed setting, as the host's log takes it.
 */
export type SettingsLog = {
  /**
   * The name of the event.
   */
  event: 'easel_settings'

  /**
   * Its one entry.
   */
  props: SettingsLogProps
}
