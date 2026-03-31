import axios from 'axios'
import { getOauthConfig } from '../../constants/oauth.js'
import {
  getOauthAccountInfo,
  getSubscriptionType,
  isClaudeAISubscriber,
} from '../../utils/auth.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { logError } from '../../utils/log.js'
import { isEssentialTrafficOnly } from '../../utils/privacyLevel.js'
import { getOAuthHeaders, prepareApiRequest } from '../../utils/teleport/api.js'
import type {
  ReferralCampaign,
  ReferralEligibilityResponse,
  ReferralRedemptionsResponse,
  ReferrerRewardInfo,
} from '../oauth/types.js'

// Cache expiration time: 24 hours (eligibility changes only on subscription/experiment changes)
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000

// Track in-flight fetch to prevent duplicate API calls
let fetchInProgress: Promise<ReferralEligibilityResponse | null> | null = null

export async function fetchReferralEligibility(
  campaign: ReferralCampaign = 'claude_code_guest_pass',
): Promise<ReferralEligibilityResponse> {
  const { accessToken, orgUUID } = await prepareApiRequest()

  const headers = {
    ...getOAuthHeaders(accessToken),
    'x-organization-uuid': orgUUID,
  }

  const url = `${getOauthConfig().BASE_API_URL}/api/oauth/organizations/${orgUUID}/referral/eligibility`

  const response = await axios.get(url, {
    headers,
    params: { campaign },
    timeout: 5000, // 5 second timeout for background fetch
  })

  return response.data
}

export async function fetchReferralRedemptions(
  campaign: string = 'claude_code_guest_pass',
): Promise<ReferralRedemptionsResponse> {
  const { accessToken, orgUUID } = await prepareApiRequest()

  const headers = {
    ...getOAuthHeaders(accessToken),
    'x-organization-uuid': orgUUID,
  }

  const url = `${getOauthConfig().BASE_API_URL}/api/oauth/organizations/${orgUUID}/referral/redemptions`

  const response = await axios.get<ReferralRedemptionsResponse>(url, {
    headers,
    params: { campaign },
    timeout: 10000, // 10 second timeout
  })

  return response.data
}

/**
 * Prechecks for if user can access guest passes feature
 */
function shouldCheckForPasses(): boolean {
  return !!(
    getOauthAccountInfo()?.organizationUuid &&
    isClaudeAISubscriber() &&
    getSubscriptionType() === 'max'
  )
}

/**
 * Check cached passes eligibility from GlobalConfig
 * Returns current cached state and cache status
 */
export function checkCachedPassesEligibility(): {
  eligible: boolean
  needsRefresh: boolean
  hasCache: boolean
} {
  if (!shouldCheckForPasses()) {
    return {
      eligible: false,
      needsRefresh: false,
      hasCache: false,
    }
  }

  const orgId = getOauthAccountInfo()?.organizationUuid
  if (!orgId) {
    return {
      eligible: false,
      needsRefresh: false,
      hasCache: false,
    }
  }

  const config = getGlobalConfig()
  const cachedEntry = config.passesEligibilityCache?.[orgId]

  if (!cachedEntry) {
    // No cached entry, needs fetch
    return {
      eligible: false,
      needsRefresh: true,
      hasCache: false,
    }
  }

  const { eligible, timestamp } = cachedEntry
  const now = Date.now()
  const needsRefresh = now - timestamp > CACHE_EXPIRATION_MS

  return {
    eligible,
    needsRefresh,
    hasCache: true,
  }
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  BRL: 'R$',
  CAD: 'CA$',
  AUD: 'A$',
  NZD: 'NZ$',
  SGD: 'S$',
}

export function formatCreditAmount(reward: ReferrerRewardInfo): string {
  const symbol = CURRENCY_SYMBOLS[reward.currency] ?? `${reward.currency} `
  const amount = reward.amount_minor_units / 100
  const formatted = amount % 1 === 0 ? amount.toString() : amount.toFixed(2)
  return `${symbol}${formatted}`
}

/**
 * Get cached referrer reward info from eligibility cache
 * Returns the reward info if the user is in a v1 campaign, null otherwise
 */
export function getCachedReferrerReward(): ReferrerRewardInfo | null {
  const orgId = getOauthAccountInfo()?.organizationUuid
  if (!orgId) return null
  const config = getGlobalConfig()
  const cachedEntry = config.passesEligibilityCache?.[orgId]
  return cachedEntry?.referrer_reward ?? null
}

/**
 * Get the cached remaining passes count from eligibility cache
 * Returns the number of remaining passes, or null if not available
 */
export function getCachedRemainingPasses(): number | null {
  const orgId = getOauthAccountInfo()?.organizationUuid
  if (!orgId) return null
  const config = getGlobalConfig()
  const cachedEntry = config.passesEligibilityCache?.[orgId]
  return cachedEntry?.remaining_passes ?? null
}

/**
 * Fetch passes eligibility and store in GlobalConfig
 * Returns the fetched response or null on error
 */
export async function fetchAndStorePassesEligibility(): Promise<ReferralEligibilityResponse | null> {
  // Return existing promise if fetch is already in progress
  if (fetchInProgress) {
    logForDebugging('Passes: Reusing in-flight eligibility fetch')
    return fetchInProgress
  }

  const orgId = getOauthAccountInfo()?.organizationUuid

  if (!orgId) {
    return null
  }

  // Store the promise to share with concurrent calls
  fetchInProgress = (async () => {
    try {
      const response = await fetchReferralEligibility()

      const cacheEntry = {
        ...response,
        timestamp: Date.now(),
      }

      saveGlobalConfig(current => ({
        ...current,
        passesEligibilityCache: {
          ...current.passesEligibilityCache,
          [orgId]: cacheEntry,
        },
      }))

      logForDebugging(
        `Passes eligibility cached for org ${orgId}: ${response.eligible}`,
      )

      return response
    } catch (error) {
      logForDebugging('Failed to fetch and cache passes eligibility')
      logError(error as Error)
      return null
    } finally {
      // Clear the promise when done
      fetchInProgress = null
    }
  })()

  return fetchInProgress
}

/**
 * Get cached passes eligibility data or fetch if needed
 * Main entry point for all eligibility checks
 *
 * This function never blocks on network - it returns cached data immediately
 * and fetches in the background if needed. On cold start (no cache), it returns
 * null and the passes command won't be available until the next session.
 */
export async function getCachedOrFetchPassesEligibility(): Promise<ReferralEligibilityResponse | null> {
  if (!shouldCheckForPasses()) {
    return null
  }

  const orgId = getOauthAccountInfo()?.organizationUuid
  if (!orgId) {
    return null
  }

  const config = getGlobalConfig()
  const cachedEntry = config.passesEligibilityCache?.[orgId]
  const now = Date.now()

  // No cache - trigger background fetch and return null (non-blocking)
  // The passes command won't be available this session, but will be next time
  if (!cachedEntry) {
    logForDebugging(
      'Passes: No cache, fetching eligibility in background (command unavailable this session)',
    )
    void fetchAndStorePassesEligibility()
    return null
  }

  // Cache exists but is stale - return stale cache and trigger background refresh
  if (now - cachedEntry.timestamp > CACHE_EXPIRATION_MS) {
    logForDebugging(
      'Passes: Cache stale, returning cached data and refreshing in background',
    )
    void fetchAndStorePassesEligibility() // Background refresh
    const { timestamp, ...response } = cachedEntry
    return response as ReferralEligibilityResponse
  }

  // Cache is fresh - return it immediately
  logForDebugging('Passes: Using fresh cached eligibility data')
  const { timestamp, ...response } = cachedEntry
  return response as ReferralEligibilityResponse
}

/**
 * Prefetch passes eligibility on startup
 */
export async function prefetchPassesEligibility(): Promise<void> {
  // Skip network requests if nonessential traffic is disabled
  if (isEssentialTrafficOnly()) {
    return
  }

  void getCachedOrFetchPassesEligibility()
}
