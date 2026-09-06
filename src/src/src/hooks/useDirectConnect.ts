import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { ToolUseConfirm } from '../components/permissions/PermissionRequest.js'
import type { RemotePermissionResponse } from '../remote/RemoteSessionManager.js'
import {
  createSyntheticAssistantMessage,
  createToolStub,
} from '../remote/remotePermissionBridge.js'
import {
  convertSDKMessage,
  isSessionEndMessage,
} from '../remote/sdkMessageAdapter.js'
import {
  type DirectConnectConfig,
  DirectConnectSessionManager,
} from '../server/directConnectManager.js'
import type { Tool } from '../Tool.js'
import { findToolByName } from '../Tool.js'
import type { Message as MessageType } from '../types/message.js'
import type { PermissionAskDecision } from '../types/permissions.js'
import { logForDebugging } from '../utils/debug.js'
import { gracefulShutdown } from '../utils/gracefulShutdown.js'
import type { RemoteMessageContent } from '../utils/teleport/api.js'

type UseDirectConnectResult = {
  isRemoteMode: boolean
  sendMessage: (content: RemoteMessageContent) => Promise<boolean>
  cancelRequest: () => void
  disconnect: () => void
}

type UseDirectConnectProps = {
  config: DirectConnectConfig | undefined
  setMessages: React.Dispatch<React.SetStateAction<MessageType[]>>
  setIsLoading: (loading: boolean) => void
  setToolUseConfirmQueue: React.Dispatch<React.SetStateAction<ToolUseConfirm[]>>
  tools: Tool[]
}

export function useDirectConnect({
  config,
  setMessages,
  setIsLoading,
  setToolUseConfirmQueue,
  tools,
}: UseDirectConnectProps): UseDirectConnectResult {
  const isRemoteMode = !!config

  const managerRef = useRef<DirectConnectSessionManager | null>(null)
  const hasReceivedInitRef = useRef(false)
  const isConnectedRef = useRef(false)

  // Keep a ref to tools so the WebSocket callback doesn't go stale
  const toolsRef = useRef(tools)
  useEffect(() => {
    toolsRef.current = tools
  }, [tools])

  useEffect(() => {
    if (!config) {
      return
    }

    hasReceivedInitRef.current = false
    logForDebugging(`[useDirectConnect] Connecting to ${config.wsUrl}`)

    const manager = new DirectConnectSessionManager(config, {
      onMessage: sdkMessage => {
        if (isSessionEndMessage(sdkMessage)) {
          setIsLoading(false)
        }

        // Skip duplicate init messages (server sends one per turn)
        if (sdkMessage.type === 'system' && sdkMessage.subtype === 'init') {
          if (hasReceivedInitRef.current) {
            return
          }
          hasReceivedInitRef.current = true
        }

        const converted = convertSDKMessage(sdkMessage, {
          convertToolResults: true,
        })
        if (converted.type === 'message') {
          setMessages(prev => [...prev, converted.message])
        }
      },
      onPermissionRequest: (request, requestId) => {
        logForDebugging(
          `[useDirectConnect] Permission request for tool: ${request.tool_name}`,
        )

        const tool =
          findToolByName(toolsRef.current, request.tool_name) ??
          createToolStub(request.tool_name)

        const syntheticMessage = createSyntheticAssistantMessage(
          request,
          requestId,
        )

        const permissionResult: PermissionAskDecision = {
          behavior: 'ask',
          message:
            request.description ?? `${request.tool_name} requires permission`,
          suggestions: request.permission_suggestions,
          blockedPath: request.blocked_path,
        }

        const toolUseConfirm: ToolUseConfirm = {
          assistantMessage: syntheticMessage,
          tool,
          description:
            request.description ?? `${request.tool_name} requires permission`,
          input: request.input,
          toolUseContext: {} as ToolUseConfirm['toolUseContext'],
          toolUseID: request.tool_use_id,
          permissionResult,
          permissionPromptStartTimeMs: Date.now(),
          onUserInteraction() {
            // No-op for remote
          },
          onAbort() {
            const response: RemotePermissionResponse = {
              behavior: 'deny',
              message: 'User aborted',
            }
            manager.respondToPermissionRequest(requestId, response)
            setToolUseConfirmQueue(queue =>
              queue.filter(item => item.toolUseID !== request.tool_use_id),
            )
          },
          onAllow(updatedInput, _permissionUpdates, _feedback) {
            const response: RemotePermissionResponse = {
              behavior: 'allow',
              updatedInput,
            }
            manager.respondToPermissionRequest(requestId, response)
            setToolUseConfirmQueue(queue =>
              queue.filter(item => item.toolUseID !== request.tool_use_id),
            )
            setIsLoading(true)
          },
          onReject(feedback?: string) {
            const response: RemotePermissionResponse = {
              behavior: 'deny',
              message: feedback ?? 'User denied permission',
            }
            manager.respondToPermissionRequest(requestId, response)
            setToolUseConfirmQueue(queue =>
              queue.filter(item => item.toolUseID !== request.tool_use_id),
            )
          },
          async recheckPermission() {
            // No-op for remote
          },
        }

        setToolUseConfirmQueue(queue => [...queue, toolUseConfirm])
        setIsLoading(false)
      },
      onConnected: () => {
        logForDebugging('[useDirectConnect] Connected')
        isConnectedRef.current = true
      },
      onDisconnected: () => {
        logForDebugging('[useDirectConnect] Disconnected')
        if (!isConnectedRef.current) {
          // Never connected — connection failure (e.g. auth rejected)
          process.stderr.write(
            `\nFailed to connect to server at ${config.wsUrl}\n`,
          )
        } else {
          // Was connected then lost — server process exited or network dropped
          process.stderr.write('\nServer disconnected.\n')
        }
        isConnectedRef.current = false
        void gracefulShutdown(1)
        setIsLoading(false)
      },
      onError: error => {
        logForDebugging(`[useDirectConnect] Error: ${error.message}`)
      },
    })

    managerRef.current = manager
    manager.connect()

    return () => {
      logForDebugging('[useDirectConnect] Cleanup - disconnecting')
      manager.disconnect()
      managerRef.current = null
    }
  }, [config, setMessages, setIsLoading, setToolUseConfirmQueue])

  const sendMessage = useCallback(
    async (content: RemoteMessageContent): Promise<boolean> => {
      const manager = managerRef.current
      if (!manager) {
        return false
      }

      setIsLoading(true)

      return manager.sendMessage(content)
    },
    [setIsLoading],
  )

  // Cancel the current request
  const cancelRequest = useCallback(() => {
    // Send interrupt signal to the server
    managerRef.current?.sendInterrupt()

    setIsLoading(false)
  }, [setIsLoading])

  const disconnect = useCallback(() => {
    managerRef.current?.disconnect()
    managerRef.current = null
    isConnectedRef.current = false
  }, [])

  // Same stability concern as useRemoteSession — memoize so consumers
  // that depend on the result object don't see a fresh reference per render.
  return useMemo(
    () => ({ isRemoteMode, sendMessage, cancelRequest, disconnect }),
    [isRemoteMode, sendMessage, cancelRequest, disconnect],
  )
}
