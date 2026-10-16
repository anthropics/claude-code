import { checkOpus1mAccess, checkSonnet1mAccess } from './check1mAccess.js'
import { getUserSpecifiedModelSetting } from './model.js'

// @[MODEL LAUNCH]: Add a branch for the new model if it supports a 1M context upgrade path.
/**
 * Get available model upgrade for more context
 * Returns null if no upgrade available or user already has max context
 */
function getAvailableUpgrade(): {
  alias: string
  name: string
  multiplier: number
} | null {
  const currentModelSetting = getUserSpecifiedModelSetting()
  if (currentModelSetting === 'opus' && checkOpus1mAccess()) {
    return {
      alias: 'opus[1m]',
      name: 'Opus 1M',
      multiplier: 5,
    }
  } else if (currentModelSetting === 'sonnet' && checkSonnet1mAccess()) {
    return {
      alias: 'sonnet[1m]',
      name: 'Sonnet 1M',
      multiplier: 5,
    }
  }

  return null
}

/**
 * Get upgrade message for different contexts
 */
export function getUpgradeMessage(context: 'warning' | 'tip'): string | null {
  const upgrade = getAvailableUpgrade()
  if (!upgrade) return null

  switch (context) {
    case 'warning':
      return `/model ${upgrade.alias}`
    case 'tip':
      return `Tip: You have access to ${upgrade.name} with ${upgrade.multiplier}x more context`
    default:
      return null
  }
}
