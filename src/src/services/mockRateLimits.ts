// Mock rate limits for testing [ANT-ONLY]
// This allows testing various rate limit scenarios without hitting actual limits
//
// ⚠️  WARNING: This is for internal testing/demo purposes only!
// The mock headers may not exactly match the API specification or real-world behavior.
// Always validate against actual API responses before relying on this for production features.

import type { SubscriptionType } from '../services/oauth/types.js'
import { setMockBillingAccessOverride } from '../utils/billing.js'
import type { OverageDisabledReason } from './claudeAiLimits.js'

type MockHeaders = {
  'anthropic-ratelimit-unified-status'?:
    | 'allowed'
    | 'allowed_warning'
    | 'rejected'
  'anthropic-ratelimit-unified-reset'?: string
  'anthropic-ratelimit-unified-representative-claim'?:
    | 'five_hour'
    | 'seven_day'
    | 'seven_day_opus'
    | 'seven_day_sonnet'
  'anthropic-ratelimit-unified-overage-status'?:
    | 'allowed'
    | 'allowed_warning'
    | 'rejected'
  'anthropic-ratelimit-unified-overage-reset'?: string
  'anthropic-ratelimit-unified-overage-disabled-reason'?: OverageDisabledReason
  'anthropic-ratelimit-unified-fallback'?: 'available'
  'anthropic-ratelimit-unified-fallback-percentage'?: string
  'retry-after'?: string
  // Early warning utilization headers
  'anthropic-ratelimit-unified-5h-utilization'?: string
  'anthropic-ratelimit-unified-5h-reset'?: string
  'anthropic-ratelimit-unified-5h-surpassed-threshold'?: string
  'anthropic-ratelimit-unified-7d-utilization'?: string
  'anthropic-ratelimit-unified-7d-reset'?: string
  'anthropic-ratelimit-unified-7d-surpassed-threshold'?: string
  'anthropic-ratelimit-unified-overage-utilization'?: string
  'anthropic-ratelimit-unified-overage-surpassed-threshold'?: string
}

export type MockHeaderKey =
  | 'status'
  | 'reset'
  | 'claim'
  | 'overage-status'
  | 'overage-reset'
  | 'overage-disabled-reason'
  | 'fallback'
  | 'fallback-percentage'
  | 'retry-after'
  | '5h-utilization'
  | '5h-reset'
  | '5h-surpassed-threshold'
  | '7d-utilization'
  | '7d-reset'
  | '7d-surpassed-threshold'

export type MockScenario =
  | 'normal'
  | 'session-limit-reached'
  | 'approaching-weekly-limit'
  | 'weekly-limit-reached'
  | 'overage-active'
  | 'overage-warning'
  | 'overage-exhausted'
  | 'out-of-credits'
  | 'org-zero-credit-limit'
  | 'org-spend-cap-hit'
  | 'member-zero-credit-limit'
  | 'seat-tier-zero-credit-limit'
  | 'opus-limit'
  | 'opus-warning'
  | 'sonnet-limit'
  | 'sonnet-warning'
  | 'fast-mode-limit'
  | 'fast-mode-short-limit'
  | 'extra-usage-required'
  | 'clear'

let mockHeaders: MockHeaders = {}
let mockEnabled = false
let mockHeaderless429Message: string | null = null
let mockSubscriptionType: SubscriptionType | null = null
let mockFastModeRateLimitDurationMs: number | null = null
let mockFastModeRateLimitExpiresAt: number | null = null
// Default subscription type for mock testing
const DEFAULT_MOCK_SUBSCRIPTION: SubscriptionType = 'max'

// Track individual exceeded limits with their reset times
type ExceededLimit = {
  type: 'five_hour' | 'seven_day' | 'seven_day_opus' | 'seven_day_sonnet'
  resetsAt: number // Unix timestamp
}

let exceededLimits: ExceededLimit[] = []

// New approach: Toggle individual headers
export function setMockHeader(
  key: MockHeaderKey,
  value: string | undefined,
): void {
  if (process.env.USER_TYPE !== 'ant') {
    return
  }

  mockEnabled = true

  // Special case for retry-after which doesn't have the prefix
  const fullKey = (
    key === 'retry-after' ? 'retry-after' : `anthropic-ratelimit-unified-${key}`
  ) as keyof MockHeaders

  if (value === undefined || value === 'clear') {
    delete mockHeaders[fullKey]
    if (key === 'claim') {
      exceededLimits = []
    }
    // Update retry-after if status changed
    if (key === 'status' || key === 'overage-status') {
      updateRetryAfter()
    }
    return
  } else {
    // Handle special cases for reset times
    if (key === 'reset' || key === 'overage-reset') {
      // If user provides a number, treat it as hours from now
      const hours = Number(value)
      if (!isNaN(hours)) {
        value = String(Math.floor(Date.now() / 1000) + hours * 3600)
      }
    }

    // Handle claims - add to exceeded limits
    if (key === 'claim') {
      const validClaims = [
        'five_hour',
        'seven_day',
        'seven_day_opus',
        'seven_day_sonnet',
      ]
      if (validClaims.includes(value)) {
        // Determine reset time based on claim type
        let resetsAt: number
        if (value === 'five_hour') {
          resetsAt = Math.floor(Date.now() / 1000) + 5 * 3600
        } else if (
          value === 'seven_day' ||
          value === 'seven_day_opus' ||
          value === 'seven_day_sonnet'
        ) {
          resetsAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600
        } else {
          resetsAt = Math.floor(Date.now() / 1000) + 3600
        }

        // Add to exceeded limits (remove if already exists)
        exceededLimits = exceededLimits.filter(l => l.type !== value)
        exceededLimits.push({ type: value as ExceededLimit['type'], resetsAt })

        // Set the representative claim (furthest reset time)
        updateRepresentativeClaim()
        return
      }
    }
    // Widen to a string-valued record so dynamic key assignment is allowed.
    // MockHeaders values are string-literal unions; assigning a raw user-input
    // string requires widening, but this is mock/test code so it's acceptable.
    const headers: Partial<Record<keyof MockHeaders, string>> = mockHeaders
    headers[fullKey] = value

    // Update retry-after if status changed
    if (key === 'status' || key === 'overage-status') {
      updateRetryAfter()
    }
  }

  // If all headers are cleared, disable mocking
  if (Object.keys(mockHeaders).length === 0) {
    mockEnabled = false
  }
}

// Helper to update retry-after based on current state
function updateRetryAfter(): void {
  const status = mockHeaders['anthropic-ratelimit-unified-status']
  const overageStatus =
    mockHeaders['anthropic-ratelimit-unified-overage-status']
  const reset = mockHeaders['anthropic-ratelimit-unified-reset']

  if (
    status === 'rejected' &&
    (!overageStatus || overageStatus === 'rejected') &&
    reset
  ) {
    // Calculate seconds until reset
    const resetTimestamp = Number(reset)
    const secondsUntilReset = Math.max(
      0,
      resetTimestamp - Math.floor(Date.now() / 1000),
    )
    mockHeaders['retry-after'] = String(secondsUntilReset)
  } else {
    delete mockHeaders['retry-after']
  }
}

// Update the representative claim based on exceeded limits
function updateRepresentativeClaim(): void {
  if (exceededLimits.length === 0) {
    delete mockHeaders['anthropic-ratelimit-unified-representative-claim']
    delete mockHeaders['anthropic-ratelimit-unified-reset']
    delete mockHeaders['retry-after']
    return
  }

  // Find the limit with the furthest reset time
  const furthest = exceededLimits.reduce((prev, curr) =>
    curr.resetsAt > prev.resetsAt ? curr : prev,
  )

  // Set the representative claim (appears for both warning and rejected)
  mockHeaders['anthropic-ratelimit-unified-representative-claim'] =
    furthest.type
  mockHeaders['anthropic-ratelimit-unified-reset'] = String(furthest.resetsAt)

  // Add retry-after if rejected and no overage available
  if (mockHeaders['anthropic-ratelimit-unified-status'] === 'rejected') {
    const overageStatus =
      mockHeaders['anthropic-ratelimit-unified-overage-status']
    if (!overageStatus || overageStatus === 'rejected') {
      // Calculate seconds until reset
      const secondsUntilReset = Math.max(
        0,
        furthest.resetsAt - Math.floor(Date.now() / 1000),
      )
      mockHeaders['retry-after'] = String(secondsUntilReset)
    } else {
      // Overage is available, no retry-after
      delete mockHeaders['retry-after']
    }
  } else {
    delete mockHeaders['retry-after']
  }
}

// Add function to add exceeded limit with custom reset time
export function addExceededLimit(
  type: 'five_hour' | 'seven_day' | 'seven_day_opus' | 'seven_day_sonnet',
  hoursFromNow: number,
): void {
  if (process.env.USER_TYPE !== 'ant') {
    return
  }

  mockEnabled = true
  const resetsAt = Math.floor(Date.now() / 1000) + hoursFromNow * 3600

  // Remove existing limit of same type
  exceededLimits = exceededLimits.filter(l => l.type !== type)
  exceededLimits.push({ type, resetsAt })

  // Update status to rejected if we have exceeded limits
  if (exceededLimits.length > 0) {
    mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
  }

  updateRepresentativeClaim()
}

// Set mock early warning utilization for time-relative thresholds
// claimAbbrev: '5h' or '7d'
// utilization: 0-1 (e.g., 0.92 for 92% used)
// hoursFromNow: hours until reset (default: 4 for 5h, 120 for 7d)
export function setMockEarlyWarning(
  claimAbbrev: '5h' | '7d' | 'overage',
  utilization: number,
  hoursFromNow?: number,
): void {
  if (process.env.USER_TYPE !== 'ant') {
    return
  }

  mockEnabled = true

  // Clear ALL early warning headers first (5h is checked before 7d, so we need
  // to clear 5h headers when testing 7d to avoid 5h taking priority)
  clearMockEarlyWarning()

  // Default hours based on claim type (early in window to trigger warning)
  const defaultHours = claimAbbrev === '5h' ? 4 : 5 * 24
  const hours = hoursFromNow ?? defaultHours
  const resetsAt = Math.floor(Date.now() / 1000) + hours * 3600

  mockHeaders[`anthropic-ratelimit-unified-${claimAbbrev}-utilization`] =
    String(utilization)
  mockHeaders[`anthropic-ratelimit-unified-${claimAbbrev}-reset`] =
    String(resetsAt)
  // Set the surpassed-threshold header to trigger early warning
  mockHeaders[
    `anthropic-ratelimit-unified-${claimAbbrev}-surpassed-threshold`
  ] = String(utilization)

  // Set status to allowed so early warning logic can upgrade it
  if (!mockHeaders['anthropic-ratelimit-unified-status']) {
    mockHeaders['anthropic-ratelimit-unified-status'] = 'allowed'
  }
}

// Clear mock early warning headers
export function clearMockEarlyWarning(): void {
  delete mockHeaders['anthropic-ratelimit-unified-5h-utilization']
  delete mockHeaders['anthropic-ratelimit-unified-5h-reset']
  delete mockHeaders['anthropic-ratelimit-unified-5h-surpassed-threshold']
  delete mockHeaders['anthropic-ratelimit-unified-7d-utilization']
  delete mockHeaders['anthropic-ratelimit-unified-7d-reset']
  delete mockHeaders['anthropic-ratelimit-unified-7d-surpassed-threshold']
}

export function setMockRateLimitScenario(scenario: MockScenario): void {
  if (process.env.USER_TYPE !== 'ant') {
    return
  }

  if (scenario === 'clear') {
    mockHeaders = {}
    mockHeaderless429Message = null
    mockEnabled = false
    return
  }

  mockEnabled = true

  // Set reset times for demos
  const fiveHoursFromNow = Math.floor(Date.now() / 1000) + 5 * 3600
  const sevenDaysFromNow = Math.floor(Date.now() / 1000) + 7 * 24 * 3600

  // Clear existing headers
  mockHeaders = {}
  mockHeaderless429Message = null

  // Only clear exceeded limits for scenarios that explicitly set them
  // Overage scenarios should preserve existing exceeded limits
  const preserveExceededLimits = [
    'overage-active',
    'overage-warning',
    'overage-exhausted',
  ].includes(scenario)
  if (!preserveExceededLimits) {
    exceededLimits = []
  }

  switch (scenario) {
    case 'normal':
      mockHeaders = {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-reset': String(fiveHoursFromNow),
      }
      break

    case 'session-limit-reached':
      exceededLimits = [{ type: 'five_hour', resetsAt: fiveHoursFromNow }]
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      break

    case 'approaching-weekly-limit':
      mockHeaders = {
        'anthropic-ratelimit-unified-status': 'allowed_warning',
        'anthropic-ratelimit-unified-reset': String(sevenDaysFromNow),
        'anthropic-ratelimit-unified-representative-claim': 'seven_day',
      }
      break

    case 'weekly-limit-reached':
      exceededLimits = [{ type: 'seven_day', resetsAt: sevenDaysFromNow }]
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      break

    case 'overage-active': {
      // If no limits have been exceeded yet, default to 5-hour
      if (exceededLimits.length === 0) {
        exceededLimits = [{ type: 'five_hour', resetsAt: fiveHoursFromNow }]
      }
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-status'] = 'allowed'
      // Set overage reset time (monthly)
      const endOfMonthActive = new Date()
      endOfMonthActive.setMonth(endOfMonthActive.getMonth() + 1, 1)
      endOfMonthActive.setHours(0, 0, 0, 0)
      mockHeaders['anthropic-ratelimit-unified-overage-reset'] = String(
        Math.floor(endOfMonthActive.getTime() / 1000),
      )
      break
    }

    case 'overage-warning': {
      // If no limits have been exceeded yet, default to 5-hour
      if (exceededLimits.length === 0) {
        exceededLimits = [{ type: 'five_hour', resetsAt: fiveHoursFromNow }]
      }
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-status'] =
        'allowed_warning'
      // Overage typically resets monthly, but for demo let's say end of month
      const endOfMonth = new Date()
      endOfMonth.setMonth(endOfMonth.getMonth() + 1, 1)
      endOfMonth.setHours(0, 0, 0, 0)
      mockHeaders['anthropic-ratelimit-unified-overage-reset'] = String(
        Math.floor(endOfMonth.getTime() / 1000),
      )
      break
    }

    case 'overage-exhausted': {
      // If no limits have been exceeded yet, default to 5-hour
      if (exceededLimits.length === 0) {
        exceededLimits = [{ type: 'five_hour', resetsAt: fiveHoursFromNow }]
      }
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-status'] = 'rejected'
      // Both subscription and overage are exhausted
      // Subscription resets based on the exceeded limit, overage resets monthly
      const endOfMonthExhausted = new Date()
      endOfMonthExhausted.setMonth(endOfMonthExhausted.getMonth() + 1, 1)
      endOfMonthExhausted.setHours(0, 0, 0, 0)
      mockHeaders['anthropic-ratelimit-unified-overage-reset'] = String(
        Math.floor(endOfMonthExhausted.getTime() / 1000),
      )
      break
    }

    case 'out-of-credits': {
      // Out of credits - subscription limit hit, overage rejected due to insufficient credits
      // (wallet is empty)
      if (exceededLimits.length === 0) {
        exceededLimits = [{ type: 'five_hour', resetsAt: fiveHoursFromNow }]
      }
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-disabled-reason'] =
        'out_of_credits'
      const endOfMonth = new Date()
      endOfMonth.setMonth(endOfMonth.getMonth() + 1, 1)
      endOfMonth.setHours(0, 0, 0, 0)
      mockHeaders['anthropic-ratelimit-unified-overage-reset'] = String(
        Math.floor(endOfMonth.getTime() / 1000),
      )
      break
    }

    case 'org-zero-credit-limit': {
      // Org service has zero credit limit - admin set org-level spend cap to $0
      // Non-admin Team/Enterprise users should not see "Request extra usage" option
      if (exceededLimits.length === 0) {
        exceededLimits = [{ type: 'five_hour', resetsAt: fiveHoursFromNow }]
      }
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-disabled-reason'] =
        'org_service_zero_credit_limit'
      const endOfMonthZero = new Date()
      endOfMonthZero.setMonth(endOfMonthZero.getMonth() + 1, 1)
      endOfMonthZero.setHours(0, 0, 0, 0)
      mockHeaders['anthropic-ratelimit-unified-overage-reset'] = String(
        Math.floor(endOfMonthZero.getTime() / 1000),
      )
      break
    }

    case 'org-spend-cap-hit': {
      // Org spend cap hit for the month - org overages temporarily disabled
      // Non-admin Team/Enterprise users should not see "Request extra usage" option
      if (exceededLimits.length === 0) {
        exceededLimits = [{ type: 'five_hour', resetsAt: fiveHoursFromNow }]
      }
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-disabled-reason'] =
        'org_level_disabled_until'
      const endOfMonthHit = new Date()
      endOfMonthHit.setMonth(endOfMonthHit.getMonth() + 1, 1)
      endOfMonthHit.setHours(0, 0, 0, 0)
      mockHeaders['anthropic-ratelimit-unified-overage-reset'] = String(
        Math.floor(endOfMonthHit.getTime() / 1000),
      )
      break
    }

    case 'member-zero-credit-limit': {
      // Member has zero credit limit - admin set this user's individual limit to $0
      // Non-admin Team/Enterprise users SHOULD see "Request extra usage" (admin can allocate more)
      if (exceededLimits.length === 0) {
        exceededLimits = [{ type: 'five_hour', resetsAt: fiveHoursFromNow }]
      }
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-disabled-reason'] =
        'member_zero_credit_limit'
      const endOfMonthMember = new Date()
      endOfMonthMember.setMonth(endOfMonthMember.getMonth() + 1, 1)
      endOfMonthMember.setHours(0, 0, 0, 0)
      mockHeaders['anthropic-ratelimit-unified-overage-reset'] = String(
        Math.floor(endOfMonthMember.getTime() / 1000),
      )
      break
    }

    case 'seat-tier-zero-credit-limit': {
      // Seat tier has zero credit limit - admin set this seat tier's limit to $0
      // Non-admin Team/Enterprise users SHOULD see "Request extra usage" (admin can allocate more)
      if (exceededLimits.length === 0) {
        exceededLimits = [{ type: 'five_hour', resetsAt: fiveHoursFromNow }]
      }
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-status'] = 'rejected'
      mockHeaders['anthropic-ratelimit-unified-overage-disabled-reason'] =
        'seat_tier_zero_credit_limit'
      const endOfMonthSeatTier = new Date()
      endOfMonthSeatTier.setMonth(endOfMonthSeatTier.getMonth() + 1, 1)
      endOfMonthSeatTier.setHours(0, 0, 0, 0)
      mockHeaders['anthropic-ratelimit-unified-overage-reset'] = String(
        Math.floor(endOfMonthSeatTier.getTime() / 1000),
      )
      break
    }

    case 'opus-limit': {
      exceededLimits = [{ type: 'seven_day_opus', resetsAt: sevenDaysFromNow }]
      updateRepresentativeClaim()
      // Always send 429 rejected status - the error handler will decide whether
      // to show an error or return NO_RESPONSE_REQUESTED based on fallback eligibility
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      break
    }

    case 'opus-warning': {
      mockHeaders = {
        'anthropic-ratelimit-unified-status': 'allowed_warning',
        'anthropic-ratelimit-unified-reset': String(sevenDaysFromNow),
        'anthropic-ratelimit-unified-representative-claim': 'seven_day_opus',
      }
      break
    }

    case 'sonnet-limit': {
      exceededLimits = [
        { type: 'seven_day_sonnet', resetsAt: sevenDaysFromNow },
      ]
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      break
    }

    case 'sonnet-warning': {
      mockHeaders = {
        'anthropic-ratelimit-unified-status': 'allowed_warning',
        'anthropic-ratelimit-unified-reset': String(sevenDaysFromNow),
        'anthropic-ratelimit-unified-representative-claim': 'seven_day_sonnet',
      }
      break
    }

    case 'fast-mode-limit': {
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      // Duration in ms (> 20s threshold to trigger cooldown)
      mockFastModeRateLimitDurationMs = 10 * 60 * 1000
      break
    }

    case 'fast-mode-short-limit': {
      updateRepresentativeClaim()
      mockHeaders['anthropic-ratelimit-unified-status'] = 'rejected'
      // Duration in ms (< 20s threshold, won't trigger cooldown)
      mockFastModeRateLimitDurationMs = 10 * 1000
      break
    }

    case 'extra-usage-required': {
      // Headerless 429 — exercises the entitlement-rejection path in errors.ts
      mockHeaderless429Message =
        'Extra usage is required for long context requests.'
      break
    }

    default:
      break
  }
}

export function getMockHeaderless429Message(): string | null {
  if (process.env.USER_TYPE !== 'ant') {
    return null
  }
  // Env var path for -p / SDK testing where slash commands aren't available
  if (process.env.CLAUDE_MOCK_HEADERLESS_429) {
    return process.env.CLAUDE_MOCK_HEADERLESS_429
  }
  if (!mockEnabled) {
    return null
  }
  return mockHeaderless429Message
}

export function getMockHeaders(): MockHeaders | null {
  if (
    !mockEnabled ||
    process.env.USER_TYPE !== 'ant' ||
    Object.keys(mockHeaders).length === 0
  ) {
    return null
  }
  return mockHeaders
}

export function getMockStatus(): string {
  if (
    !mockEnabled ||
    (Object.keys(mockHeaders).length === 0 && !mockSubscriptionType)
  ) {
    return 'No mock headers active (using real limits)'
  }

  const lines: string[] = []
  lines.push('Active mock headers:')

  // Show subscription type - either explicitly set or default
  const effectiveSubscription =
    mockSubscriptionType || DEFAULT_MOCK_SUBSCRIPTION
  if (mockSubscriptionType) {
    lines.push(`  Subscription Type: ${mockSubscriptionType} (explicitly set)`)
  } else {
    lines.push(`  Subscription Type: ${effectiveSubscription} (default)`)
  }

  Object.entries(mockHeaders).forEach(([key, value]) => {
    if (value !== undefined) {
      // Format the header name nicely
      const formattedKey = key
        .replace('anthropic-ratelimit-unified-', '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())

      // Format timestamps as human-readable
      if (key.includes('reset') && value) {
        const timestamp = Number(value)
        const date = new Date(timestamp * 1000)
        lines.push(`  ${formattedKey}: ${value} (${date.toLocaleString()})`)
      } else {
        lines.push(`  ${formattedKey}: ${value}`)
      }
    }
  })

  // Show exceeded limits if any
  if (exceededLimits.length > 0) {
    lines.push('\nExceeded limits (contributing to representative claim):')
    exceededLimits.forEach(limit => {
      const date = new Date(limit.resetsAt * 1000)
      lines.push(`  ${limit.type}: resets at ${date.toLocaleString()}`)
    })
  }

  return lines.join('\n')
}

export function clearMockHeaders(): void {
  mockHeaders = {}
  exceededLimits = []
  mockSubscriptionType = null
  mockFastModeRateLimitDurationMs = null
  mockFastModeRateLimitExpiresAt = null
  mockHeaderless429Message = null
  setMockBillingAccessOverride(null)
  mockEnabled = false
}

export function applyMockHeaders(
  headers: globalThis.Headers,
): globalThis.Headers {
  const mock = getMockHeaders()
  if (!mock) {
    return headers
  }

  // Create a new Headers object with original headers
  // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
  const newHeaders = new globalThis.Headers(headers)

  // Apply mock headers (overwriting originals)
  Object.entries(mock).forEach(([key, value]) => {
    if (value !== undefined) {
      newHeaders.set(key, value)
    }
  })

  return newHeaders
}

// Check if we should process rate limits even without subscription
// This is for Ant employees testing with mocks
export function shouldProcessMockLimits(): boolean {
  if (process.env.USER_TYPE !== 'ant') {
    return false
  }
  return mockEnabled || Boolean(process.env.CLAUDE_MOCK_HEADERLESS_429)
}

export function getCurrentMockScenario(): MockScenario | null {
  if (!mockEnabled) {
    return null
  }

  // Reverse lookup the scenario from current headers
  if (!mockHeaders) return null

  const status = mockHeaders['anthropic-ratelimit-unified-status']
  const overage = mockHeaders['anthropic-ratelimit-unified-overage-status']
  const claim = mockHeaders['anthropic-ratelimit-unified-representative-claim']

  if (claim === 'seven_day_opus') {
    return status === 'rejected' ? 'opus-limit' : 'opus-warning'
  }

  if (claim === 'seven_day_sonnet') {
    return status === 'rejected' ? 'sonnet-limit' : 'sonnet-warning'
  }

  if (overage === 'rejected') return 'overage-exhausted'
  if (overage === 'allowed_warning') return 'overage-warning'
  if (overage === 'allowed') return 'overage-active'

  if (status === 'rejected') {
    if (claim === 'five_hour') return 'session-limit-reached'
    if (claim === 'seven_day') return 'weekly-limit-reached'
  }

  if (status === 'allowed_warning') {
    if (claim === 'seven_day') return 'approaching-weekly-limit'
  }

  if (status === 'allowed') return 'normal'

  return null
}

export function getScenarioDescription(scenario: MockScenario): string {
  switch (scenario) {
    case 'normal':
      return 'Normal usage, no limits'
    case 'session-limit-reached':
      return 'Session rate limit exceeded'
    case 'approaching-weekly-limit':
      return 'Approaching weekly aggregate limit'
    case 'weekly-limit-reached':
      return 'Weekly aggregate limit exceeded'
    case 'overage-active':
      return 'Using extra usage (overage active)'
    case 'overage-warning':
      return 'Approaching extra usage limit'
    case 'overage-exhausted':
      return 'Both subscription and extra usage limits exhausted'
    case 'out-of-credits':
      return 'Out of extra usage credits (wallet empty)'
    case 'org-zero-credit-limit':
      return 'Org spend cap is zero (no extra usage budget)'
    case 'org-spend-cap-hit':
      return 'Org spend cap hit for the month'
    case 'member-zero-credit-limit':
      return 'Member limit is zero (admin can allocate more)'
    case 'seat-tier-zero-credit-limit':
      return 'Seat tier limit is zero (admin can allocate more)'
    case 'opus-limit':
      return 'Opus limit reached'
    case 'opus-warning':
      return 'Approaching Opus limit'
    case 'sonnet-limit':
      return 'Sonnet limit reached'
    case 'sonnet-warning':
      return 'Approaching Sonnet limit'
    case 'fast-mode-limit':
      return 'Fast mode rate limit'
    case 'fast-mode-short-limit':
      return 'Fast mode rate limit (short)'
    case 'extra-usage-required':
      return 'Headerless 429: Extra usage required for 1M context'
    case 'clear':
      return 'Clear mock headers (use real limits)'
    default:
      return 'Unknown scenario'
  }
}

// Mock subscription type management
export function setMockSubscriptionType(
  subscriptionType: SubscriptionType | null,
): void {
  if (process.env.USER_TYPE !== 'ant') {
    return
  }
  mockEnabled = true
  mockSubscriptionType = subscriptionType
}

export function getMockSubscriptionType(): SubscriptionType | null {
  if (!mockEnabled || process.env.USER_TYPE !== 'ant') {
    return null
  }
  // Return the explicitly set subscription type, or default to 'max'
  return mockSubscriptionType || DEFAULT_MOCK_SUBSCRIPTION
}

// Export a function that checks if we should use mock subscription
export function shouldUseMockSubscription(): boolean {
  return (
    mockEnabled &&
    mockSubscriptionType !== null &&
    process.env.USER_TYPE === 'ant'
  )
}

// Mock billing access (admin vs non-admin)
export function setMockBillingAccess(hasAccess: boolean | null): void {
  if (process.env.USER_TYPE !== 'ant') {
    return
  }
  mockEnabled = true
  setMockBillingAccessOverride(hasAccess)
}

// Mock fast mode rate limit handling
export function isMockFastModeRateLimitScenario(): boolean {
  return mockFastModeRateLimitDurationMs !== null
}

export function checkMockFastModeRateLimit(
  isFastModeActive?: boolean,
): MockHeaders | null {
  if (mockFastModeRateLimitDurationMs === null) {
    return null
  }

  // Only throw when fast mode is active
  if (!isFastModeActive) {
    return null
  }

  // Check if the rate limit has expired
  if (
    mockFastModeRateLimitExpiresAt !== null &&
    Date.now() >= mockFastModeRateLimitExpiresAt
  ) {
    clearMockHeaders()
    return null
  }

  // Set expiry on first error (not when scenario is configured)
  if (mockFastModeRateLimitExpiresAt === null) {
    mockFastModeRateLimitExpiresAt =
      Date.now() + mockFastModeRateLimitDurationMs
  }

  // Compute dynamic retry-after based on remaining time
  const remainingMs = mockFastModeRateLimitExpiresAt - Date.now()
  const headersToSend = { ...mockHeaders }
  headersToSend['retry-after'] = String(
    Math.max(1, Math.ceil(remainingMs / 1000)),
  )

  return headersToSend
}
