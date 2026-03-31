import { fileURLToPath } from 'url'
import type { PublishDiagnosticsParams } from 'vscode-languageserver-protocol'
import { logForDebugging } from '../../utils/debug.js'
import { toError } from '../../utils/errors.js'
import { logError } from '../../utils/log.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import type { DiagnosticFile } from '../diagnosticTracking.js'
import { registerPendingLSPDiagnostic } from './LSPDiagnosticRegistry.js'
import type { LSPServerManager } from './LSPServerManager.js'

/**
 * Map LSP severity to Claude diagnostic severity
 *
 * Maps LSP severity numbers to Claude diagnostic severity strings.
 * Accepts numeric severity values (1=Error, 2=Warning, 3=Information, 4=Hint)
 * or undefined, defaulting to 'Error' for invalid/missing values.
 */
function mapLSPSeverity(
  lspSeverity: number | undefined,
): 'Error' | 'Warning' | 'Info' | 'Hint' {
  // LSP DiagnosticSeverity enum:
  // 1 = Error, 2 = Warning, 3 = Information, 4 = Hint
  switch (lspSeverity) {
    case 1:
      return 'Error'
    case 2:
      return 'Warning'
    case 3:
      return 'Info'
    case 4:
      return 'Hint'
    default:
      return 'Error'
  }
}

/**
 * Convert LSP diagnostics to Claude diagnostic format
 *
 * Converts LSP PublishDiagnosticsParams to DiagnosticFile[] format
 * used by Claude's attachment system.
 */
export function formatDiagnosticsForAttachment(
  params: PublishDiagnosticsParams,
): DiagnosticFile[] {
  // Parse URI (may be file:// or plain path) and normalize to file system path
  let uri: string
  try {
    // Handle both file:// URIs and plain paths
    uri = params.uri.startsWith('file://')
      ? fileURLToPath(params.uri)
      : params.uri
  } catch (error) {
    const err = toError(error)
    logError(err)
    logForDebugging(
      `Failed to convert URI to file path: ${params.uri}. Error: ${err.message}. Using original URI as fallback.`,
    )
    // Gracefully fallback to original URI - LSP servers may send malformed URIs
    uri = params.uri
  }

  const diagnostics = params.diagnostics.map(
    (diag: {
      message: string
      severity?: number
      range: {
        start: { line: number; character: number }
        end: { line: number; character: number }
      }
      source?: string
      code?: string | number
    }) => ({
      message: diag.message,
      severity: mapLSPSeverity(diag.severity),
      range: {
        start: {
          line: diag.range.start.line,
          character: diag.range.start.character,
        },
        end: {
          line: diag.range.end.line,
          character: diag.range.end.character,
        },
      },
      source: diag.source,
      code:
        diag.code !== undefined && diag.code !== null
          ? String(diag.code)
          : undefined,
    }),
  )

  return [
    {
      uri,
      diagnostics,
    },
  ]
}

/**
 * Handler registration result with tracking data
 */
export type HandlerRegistrationResult = {
  /** Total number of servers */
  totalServers: number
  /** Number of successful registrations */
  successCount: number
  /** Registration errors per server */
  registrationErrors: Array<{ serverName: string; error: string }>
  /** Runtime failure tracking (shared across all handler invocations) */
  diagnosticFailures: Map<string, { count: number; lastError: string }>
}

/**
 * Register LSP notification handlers on all servers
 *
 * Sets up handlers to listen for textDocument/publishDiagnostics notifications
 * from all LSP servers and routes them to Claude's diagnostic system.
 * Uses public getAllServers() API for clean access to server instances.
 *
 * @returns Tracking data for registration status and runtime failures
 */
export function registerLSPNotificationHandlers(
  manager: LSPServerManager,
): HandlerRegistrationResult {
  // Register handlers on all configured servers to capture diagnostics from any language
  const servers = manager.getAllServers()

  // Track partial failures - allow successful server registrations even if some fail
  const registrationErrors: Array<{ serverName: string; error: string }> = []
  let successCount = 0

  // Track consecutive failures per server to warn users after 3+ failures
  const diagnosticFailures: Map<string, { count: number; lastError: string }> =
    new Map()

  for (const [serverName, serverInstance] of servers.entries()) {
    try {
      // Validate server instance has onNotification method
      if (
        !serverInstance ||
        typeof serverInstance.onNotification !== 'function'
      ) {
        const errorMsg = !serverInstance
          ? 'Server instance is null/undefined'
          : 'Server instance has no onNotification method'

        registrationErrors.push({ serverName, error: errorMsg })

        const err = new Error(`${errorMsg} for ${serverName}`)
        logError(err)
        logForDebugging(
          `Skipping handler registration for ${serverName}: ${errorMsg}`,
        )
        continue // Skip this server but track the failure
      }

      // Errors are isolated to avoid breaking other servers
      serverInstance.onNotification(
        'textDocument/publishDiagnostics',
        (params: unknown) => {
          logForDebugging(
            `[PASSIVE DIAGNOSTICS] Handler invoked for ${serverName}! Params type: ${typeof params}`,
          )
          try {
            // Validate params structure before casting
            if (
              !params ||
              typeof params !== 'object' ||
              !('uri' in params) ||
              !('diagnostics' in params)
            ) {
              const err = new Error(
                `LSP server ${serverName} sent invalid diagnostic params (missing uri or diagnostics)`,
              )
              logError(err)
              logForDebugging(
                `Invalid diagnostic params from ${serverName}: ${jsonStringify(params)}`,
              )
              return
            }

            const diagnosticParams = params as PublishDiagnosticsParams
            logForDebugging(
              `Received diagnostics from ${serverName}: ${diagnosticParams.diagnostics.length} diagnostic(s) for ${diagnosticParams.uri}`,
            )

            // Convert LSP diagnostics to Claude format (can throw on invalid URIs)
            const diagnosticFiles =
              formatDiagnosticsForAttachment(diagnosticParams)

            // Only send notification if there are diagnostics
            const firstFile = diagnosticFiles[0]
            if (
              !firstFile ||
              diagnosticFiles.length === 0 ||
              firstFile.diagnostics.length === 0
            ) {
              logForDebugging(
                `Skipping empty diagnostics from ${serverName} for ${diagnosticParams.uri}`,
              )
              return
            }

            // Register diagnostics for async delivery via attachment system
            // Follows same pattern as AsyncHookRegistry for consistent async attachment delivery
            try {
              registerPendingLSPDiagnostic({
                serverName,
                files: diagnosticFiles,
              })

              logForDebugging(
                `LSP Diagnostics: Registered ${diagnosticFiles.length} diagnostic file(s) from ${serverName} for async delivery`,
              )

              // Success - reset failure counter for this server
              diagnosticFailures.delete(serverName)
            } catch (error) {
              const err = toError(error)
              logError(err)
              logForDebugging(
                `Error registering LSP diagnostics from ${serverName}: ` +
                  `URI: ${diagnosticParams.uri}, ` +
                  `Diagnostic count: ${firstFile.diagnostics.length}, ` +
                  `Error: ${err.message}`,
              )

              // Track consecutive failures and warn after 3+
              const failures = diagnosticFailures.get(serverName) || {
                count: 0,
                lastError: '',
              }
              failures.count++
              failures.lastError = err.message
              diagnosticFailures.set(serverName, failures)

              if (failures.count >= 3) {
                logForDebugging(
                  `WARNING: LSP diagnostic handler for ${serverName} has failed ${failures.count} times consecutively. ` +
                    `Last error: ${failures.lastError}. ` +
                    `This may indicate a problem with the LSP server or diagnostic processing. ` +
                    `Check logs for details.`,
                )
              }
            }
          } catch (error) {
            // Catch any unexpected errors from the entire handler to prevent breaking the notification loop
            const err = toError(error)
            logError(err)
            logForDebugging(
              `Unexpected error processing diagnostics from ${serverName}: ${err.message}`,
            )

            // Track consecutive failures and warn after 3+
            const failures = diagnosticFailures.get(serverName) || {
              count: 0,
              lastError: '',
            }
            failures.count++
            failures.lastError = err.message
            diagnosticFailures.set(serverName, failures)

            if (failures.count >= 3) {
              logForDebugging(
                `WARNING: LSP diagnostic handler for ${serverName} has failed ${failures.count} times consecutively. ` +
                  `Last error: ${failures.lastError}. ` +
                  `This may indicate a problem with the LSP server or diagnostic processing. ` +
                  `Check logs for details.`,
              )
            }

            // Don't re-throw - isolate errors to this server only
          }
        },
      )

      logForDebugging(`Registered diagnostics handler for ${serverName}`)
      successCount++
    } catch (error) {
      const err = toError(error)

      registrationErrors.push({
        serverName,
        error: err.message,
      })

      logError(err)
      logForDebugging(
        `Failed to register diagnostics handler for ${serverName}: ` +
          `Error: ${err.message}`,
      )
    }
  }

  // Report overall registration status
  const totalServers = servers.size
  if (registrationErrors.length > 0) {
    const failedServers = registrationErrors
      .map(e => `${e.serverName} (${e.error})`)
      .join(', ')
    // Log aggregate failures for tracking
    logError(
      new Error(
        `Failed to register diagnostics for ${registrationErrors.length} LSP server(s): ${failedServers}`,
      ),
    )
    logForDebugging(
      `LSP notification handler registration: ${successCount}/${totalServers} succeeded. ` +
        `Failed servers: ${failedServers}. ` +
        `Diagnostics from failed servers will not be delivered.`,
    )
  } else {
    logForDebugging(
      `LSP notification handlers registered successfully for all ${totalServers} server(s)`,
    )
  }

  // Return tracking data for monitoring and testing
  return {
    totalServers,
    successCount,
    registrationErrors,
    diagnosticFailures,
  }
}
