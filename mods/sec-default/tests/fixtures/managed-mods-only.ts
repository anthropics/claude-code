import type { Settings } from 'claude-code'

import { modsPolicyOf } from './mods-policy-of.js'

/**
 * Managed settings that limit mods to the organization's.
 */
export const MANAGED_MODS_ONLY: Settings = modsPolicyOf(true)
