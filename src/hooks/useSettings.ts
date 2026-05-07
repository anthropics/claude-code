import { type AppState, useAppState } from '../state/AppState.js'

/**
 * Settings type as stored in AppState (DeepImmutable wrapped).
 * Use this type when you need to annotate variables that hold settings from useSettings().
 */
export type ReadonlySettings = AppState['settings']

/**
 * React hook to access current settings from AppState.
 * Settings automatically update when files change on disk via settingsChangeDetector.
 *
 * Use this instead of getSettings_DEPRECATED() in React components for reactive updates.
 */
export function useSettings(): ReadonlySettings {
  return useAppState(s => s.settings)
}
