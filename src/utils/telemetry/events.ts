import type { Attributes } from '@opentelemetry/api'
import { getEventLogger, getPromptId } from 'src/bootstrap/state.js'
import { logForDebugging } from '../debug.js'
import { isEnvTruthy } from '../envUtils.js'
import { getTelemetryAttributes } from '../telemetryAttributes.js'

// Monotonically increasing counter for ordering events within a session
let eventSequence = 0

// Track whether we've already warned about a null event logger to avoid spamming
let hasWarnedNoEventLogger = false

function isUserPromptLoggingEnabled() {
  return isEnvTruthy(process.env.OTEL_LOG_USER_PROMPTS)
}

export function redactIfDisabled(content: string): string {
  return isUserPromptLoggingEnabled() ? content : '<REDACTED>'
}

export async function logOTelEvent(
  eventName: string,
  metadata: { [key: string]: string | undefined } = {},
): Promise<void> {
  const eventLogger = getEventLogger()
  if (!eventLogger) {
    if (!hasWarnedNoEventLogger) {
      hasWarnedNoEventLogger = true
      logForDebugging(
        `[3P telemetry] Event dropped (no event logger initialized): ${eventName}`,
        { level: 'warn' },
      )
    }
    return
  }

  // Skip logging in test environment
  if (process.env.NODE_ENV === 'test') {
    return
  }

  const attributes: Attributes = {
    ...getTelemetryAttributes(),
    'event.name': eventName,
    'event.timestamp': new Date().toISOString(),
    'event.sequence': eventSequence++,
  }

  // Add prompt ID to events (but not metrics, where it would cause unbounded cardinality)
  const promptId = getPromptId()
  if (promptId) {
    attributes['prompt.id'] = promptId
  }

  // Workspace directory from the desktop app (host path). Events only —
  // filesystem paths are too high-cardinality for metric dimensions, and
  // the BQ metrics pipeline must never see them.
  const workspaceDir = process.env.CLAUDE_CODE_WORKSPACE_HOST_PATHS
  if (workspaceDir) {
    attributes['workspace.host_paths'] = workspaceDir.split('|')
  }

  // Add metadata as attributes - all values are already strings
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) {
      attributes[key] = value
    }
  }

  // Emit log record as an event
  eventLogger.emit({
    body: `claude_code.${eventName}`,
    attributes,
  })
}
