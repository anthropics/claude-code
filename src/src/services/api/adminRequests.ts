import axios from 'axios'
import { getOauthConfig } from '../../constants/oauth.js'
import { getOAuthHeaders, prepareApiRequest } from '../../utils/teleport/api.js'

export type AdminRequestType = 'limit_increase' | 'seat_upgrade'

export type AdminRequestStatus = 'pending' | 'approved' | 'dismissed'

export type AdminRequestSeatUpgradeDetails = {
  message?: string | null
  current_seat_tier?: string | null
}

export type AdminRequestCreateParams =
  | {
      request_type: 'limit_increase'
      details: null
    }
  | {
      request_type: 'seat_upgrade'
      details: AdminRequestSeatUpgradeDetails
    }

export type AdminRequest = {
  uuid: string
  status: AdminRequestStatus
  requester_uuid?: string | null
  created_at: string
} & (
  | {
      request_type: 'limit_increase'
      details: null
    }
  | {
      request_type: 'seat_upgrade'
      details: AdminRequestSeatUpgradeDetails
    }
)

/**
 * Create an admin request (limit increase or seat upgrade).
 *
 * For Team/Enterprise users who don't have billing/admin permissions,
 * this creates a request that their admin can act on.
 *
 * If a pending request of the same type already exists for this user,
 * returns the existing request instead of creating a new one.
 */
export async function createAdminRequest(
  params: AdminRequestCreateParams,
): Promise<AdminRequest> {
  const { accessToken, orgUUID } = await prepareApiRequest()

  const headers = {
    ...getOAuthHeaders(accessToken),
    'x-organization-uuid': orgUUID,
  }

  const url = `${getOauthConfig().BASE_API_URL}/api/oauth/organizations/${orgUUID}/admin_requests`

  const response = await axios.post<AdminRequest>(url, params, { headers })

  return response.data
}

/**
 * Get pending admin request of a specific type for the current user.
 *
 * Returns the pending request if one exists, otherwise null.
 */
export async function getMyAdminRequests(
  requestType: AdminRequestType,
  statuses: AdminRequestStatus[],
): Promise<AdminRequest[] | null> {
  const { accessToken, orgUUID } = await prepareApiRequest()

  const headers = {
    ...getOAuthHeaders(accessToken),
    'x-organization-uuid': orgUUID,
  }

  let url = `${getOauthConfig().BASE_API_URL}/api/oauth/organizations/${orgUUID}/admin_requests/me?request_type=${requestType}`
  for (const status of statuses) {
    url += `&statuses=${status}`
  }

  const response = await axios.get<AdminRequest[] | null>(url, {
    headers,
  })

  return response.data
}

type AdminRequestEligibilityResponse = {
  request_type: AdminRequestType
  is_allowed: boolean
}

/**
 * Check if a specific admin request type is allowed for this org.
 */
export async function checkAdminRequestEligibility(
  requestType: AdminRequestType,
): Promise<AdminRequestEligibilityResponse | null> {
  const { accessToken, orgUUID } = await prepareApiRequest()

  const headers = {
    ...getOAuthHeaders(accessToken),
    'x-organization-uuid': orgUUID,
  }

  const url = `${getOauthConfig().BASE_API_URL}/api/oauth/organizations/${orgUUID}/admin_requests/eligibility?request_type=${requestType}`

  const response = await axios.get<AdminRequestEligibilityResponse>(url, {
    headers,
  })

  return response.data
}
