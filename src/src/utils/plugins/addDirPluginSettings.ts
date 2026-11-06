/**
 * Reads plugin-related settings (enabledPlugins, extraKnownMarketplaces)
 * from --add-dir directories.
 *
 * These have the LOWEST priority — callers must spread standard settings
 * on top so that user/project/local/flag/policy sources all override.
 */

import { join } from 'path'
import type { z } from 'zod/v4'
import { getAdditionalDirectoriesForClaudeMd } from '../../bootstrap/state.js'
import { parseSettingsFile } from '../settings/settings.js'
import type {
  ExtraKnownMarketplaceSchema,
  SettingsJson,
} from '../settings/types.js'

type ExtraKnownMarketplace = z.infer<
  ReturnType<typeof ExtraKnownMarketplaceSchema>
>

const SETTINGS_FILES = ['settings.json', 'settings.local.json'] as const

/**
 * Returns a merged record of enabledPlugins from all --add-dir directories.
 *
 * Within each directory, settings.local.json is processed after settings.json
 * (local wins within that dir). Across directories, later CLI-order wins on
 * conflict.
 *
 * This has the lowest priority — callers must spread their standard settings
 * on top to let user/project/local/flag/policy override.
 */
export function getAddDirEnabledPlugins(): NonNullable<
  SettingsJson['enabledPlugins']
> {
  const result: NonNullable<SettingsJson['enabledPlugins']> = {}
  for (const dir of getAdditionalDirectoriesForClaudeMd()) {
    for (const file of SETTINGS_FILES) {
      const { settings } = parseSettingsFile(join(dir, '.claude', file))
      if (!settings?.enabledPlugins) {
        continue
      }
      Object.assign(result, settings.enabledPlugins)
    }
  }
  return result
}

/**
 * Returns a merged record of extraKnownMarketplaces from all --add-dir directories.
 *
 * Same priority rules as getAddDirEnabledPlugins: settings.local.json wins
 * within each dir, and callers spread standard settings on top.
 */
export function getAddDirExtraMarketplaces(): Record<
  string,
  ExtraKnownMarketplace
> {
  const result: Record<string, ExtraKnownMarketplace> = {}
  for (const dir of getAdditionalDirectoriesForClaudeMd()) {
    for (const file of SETTINGS_FILES) {
      const { settings } = parseSettingsFile(join(dir, '.claude', file))
      if (!settings?.extraKnownMarketplaces) {
        continue
      }
      Object.assign(result, settings.extraKnownMarketplaces)
    }
  }
  return result
}
