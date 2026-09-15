import type { PermissionUpdate } from '../utils/permissions/PermissionUpdateSchema.js'

type BridgePermissionResponse = {
  behavior: 'allow' | 'deny'
  updatedInput?: Record<string, unknown>
  updatedPermissions?: PermissionUpdate[]
  message?: string
}

type BridgePermissionCallbacks = {
  sendRequest(
    requestId: string,
    toolName: string,
    input: Record<string, unknown>,
    toolUseId: string,
    description: string,
    permissionSuggestions?: PermissionUpdate[],
    blockedPath?: string,
  ): void
  sendResponse(requestId: string, response: BridgePermissionResponse): void
  /** Cancel a pending control_request so the web app can dismiss its prompt. */
  cancelRequest(requestId: string): void
  onResponse(
    requestId: string,
    handler: (response: BridgePermissionResponse) => void,
  ): () => void // returns unsubscribe
}

/** Type predicate for validating a parsed control_response payload
 *  as a BridgePermissionResponse. Checks the required `behavior`
 *  discriminant rather than using an unsafe `as` cast. */
function isBridgePermissionResponse(
  value: unknown,
): value is BridgePermissionResponse {
  if (!value || typeof value !== 'object') return false
  return (
    'behavior' in value &&
    (value.behavior === 'allow' || value.behavior === 'deny')
  )
}

export { isBridgePermissionResponse }
export type { BridgePermissionCallbacks, BridgePermissionResponse }
