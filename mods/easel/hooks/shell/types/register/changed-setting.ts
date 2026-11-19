import type Usage from '../../../core/usage'

/**
 * What the user changed about charts that nobody asks for, or false where
 * the settings are as they came.
 */
export type ChangedSetting = false | Parameters<typeof Usage.settingsLogOf>[0]
