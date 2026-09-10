import { randomUUID, type UUID } from 'crypto'
import { validateUuid } from './uuid.js'

export type ParsedSessionUrl = {
  sessionId: UUID
  ingressUrl: string | null
  isUrl: boolean
  jsonlFile: string | null
  isJsonlFile: boolean
}

/**
 * Parses a session resume identifier which can be either:
 * - A URL containing session ID (e.g., https://api.example.com/v1/session_ingress/session/550e8400-e29b-41d4-a716-446655440000)
 * - A plain session ID (UUID)
 *
 * @param resumeIdentifier - The URL or session ID to parse
 * @returns Parsed session information or null if invalid
 */
export function parseSessionIdentifier(
  resumeIdentifier: string,
): ParsedSessionUrl | null {
  // Check for JSONL file path before URL parsing, since Windows absolute
  // paths (e.g., C:\path\file.jsonl) are parsed as valid URLs with C: as protocol
  if (resumeIdentifier.toLowerCase().endsWith('.jsonl')) {
    return {
      sessionId: randomUUID() as UUID,
      ingressUrl: null,
      isUrl: false,
      jsonlFile: resumeIdentifier,
      isJsonlFile: true,
    }
  }

  // Check if it's a plain UUID
  if (validateUuid(resumeIdentifier)) {
    return {
      sessionId: resumeIdentifier as UUID,
      ingressUrl: null,
      isUrl: false,
      jsonlFile: null,
      isJsonlFile: false,
    }
  }

  // Check if it's a URL
  try {
    const url = new URL(resumeIdentifier)

    // Use the entire URL as the ingress URL
    // Always generate a random session ID
    return {
      sessionId: randomUUID() as UUID,
      ingressUrl: url.href,
      isUrl: true,
      jsonlFile: null,
      isJsonlFile: false,
    }
  } catch {
    // Not a valid URL
  }

  return null
}
