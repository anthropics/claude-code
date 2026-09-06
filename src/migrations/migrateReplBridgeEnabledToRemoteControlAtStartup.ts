import { saveGlobalConfig } from '../utils/config.js'

/**
 * Migrate the `replBridgeEnabled` config key to `remoteControlAtStartup`.
 *
 * The old key was an implementation detail that leaked into user-facing config.
 * This migration copies the value to the new key and removes the old one.
 * Idempotent — only acts when the old key exists and the new one doesn't.
 */
export function migrateReplBridgeEnabledToRemoteControlAtStartup(): void {
  saveGlobalConfig(prev => {
    // The old key is no longer in the GlobalConfig type, so access it via
    // an untyped cast. Only migrate if the old key exists and the new key
    // hasn't been set yet.
    const oldValue = (prev as Record<string, unknown>)['replBridgeEnabled']
    if (oldValue === undefined) return prev
    if (prev.remoteControlAtStartup !== undefined) return prev
    const next = { ...prev, remoteControlAtStartup: Boolean(oldValue) }
    delete (next as Record<string, unknown>)['replBridgeEnabled']
    return next
  })
}
