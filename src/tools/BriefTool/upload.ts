/**
 * Upload BriefTool attachments to private_api so web viewers can preview them.
 *
 * When the repl bridge is active, attachment paths are meaningless to a web
 * viewer (they're on Claude's machine). We upload to /api/oauth/file_upload —
 * the same store MessageComposer/SpaceMessage render from — and stash the
 * returned file_uuid alongside the path. Web resolves file_uuid → preview;
 * desktop/local try path first.
 *
 * Best-effort: any failure (no token, bridge off, network error, 4xx) logs
 * debug and returns undefined. The attachment still carries {path, size,
 * isImage}, so local-terminal and same-machine-desktop render unaffected.
 */

import { feature } from 'bun:bundle'
import axios from 'axios'
import { randomUUID } from 'crypto'
import { readFile } from 'fs/promises'
import { basename, extname } from 'path'
import { z } from 'zod/v4'

import {
  getBridgeAccessToken,
  getBridgeBaseUrlOverride,
} from '../../bridge/bridgeConfig.js'
import { getOauthConfig } from '../../constants/oauth.js'
import { logForDebugging } from '../../utils/debug.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { jsonStringify } from '../../utils/slowOperations.js'

// Matches the private_api backend limit
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024

const UPLOAD_TIMEOUT_MS = 30_000

// Backend dispatches on mime: image/* → upload_image_wrapped (writes
// PREVIEW/THUMBNAIL, no ORIGINAL), everything else → upload_generic_file
// (ORIGINAL only, no preview). Only whitelist raster formats the
// transcoder reliably handles — svg/bmp/ico risk a 400, and pdf routes
// to upload_pdf_file_wrapped which also skips ORIGINAL. Dispatch
// viewers use /preview for images and /contents for everything else,
// so images go image/* and the rest go octet-stream.
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

function guessMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

function debug(msg: string): void {
  logForDebugging(`[brief:upload] ${msg}`)
}

/**
 * Base URL for uploads. Must match the host the token is valid for.
 *
 * Subprocess hosts (cowork) pass ANTHROPIC_BASE_URL alongside
 * CLAUDE_CODE_OAUTH_TOKEN — prefer that since getOauthConfig() only
 * returns staging when USE_STAGING_OAUTH is set, which such hosts don't
 * set. Without this a staging token hits api.anthropic.com → 401 → silent
 * skip → web viewer sees inert cards with no file_uuid.
 */
function getBridgeBaseUrl(): string {
  return (
    getBridgeBaseUrlOverride() ??
    process.env.ANTHROPIC_BASE_URL ??
    getOauthConfig().BASE_API_URL
  )
}

// /api/oauth/file_upload returns one of ChatMessage{Image,Blob,Document}FileSchema.
// All share file_uuid; that's the only field we need.
const uploadResponseSchema = lazySchema(() =>
  z.object({ file_uuid: z.string() }),
)

export type BriefUploadContext = {
  replBridgeEnabled: boolean
  signal?: AbortSignal
}

/**
 * Upload a single attachment. Returns file_uuid on success, undefined otherwise.
 * Every early-return is intentional graceful degradation.
 */
export async function uploadBriefAttachment(
  fullPath: string,
  size: number,
  ctx: BriefUploadContext,
): Promise<string | undefined> {
  // Positive pattern so bun:bundle eliminates the entire body from
  // non-BRIDGE_MODE builds (negative `if (!feature(...)) return` does not).
  if (feature('BRIDGE_MODE')) {
    if (!ctx.replBridgeEnabled) return undefined

    if (size > MAX_UPLOAD_BYTES) {
      debug(`skip ${fullPath}: ${size} bytes exceeds ${MAX_UPLOAD_BYTES} limit`)
      return undefined
    }

    const token = getBridgeAccessToken()
    if (!token) {
      debug('skip: no oauth token')
      return undefined
    }

    let content: Buffer
    try {
      content = await readFile(fullPath)
    } catch (e) {
      debug(`read failed for ${fullPath}: ${e}`)
      return undefined
    }

    const baseUrl = getBridgeBaseUrl()
    const url = `${baseUrl}/api/oauth/file_upload`
    const filename = basename(fullPath)
    const mimeType = guessMimeType(filename)
    const boundary = `----FormBoundary${randomUUID()}`

    // Manual multipart — same pattern as filesApi.ts. The oauth endpoint takes
    // a single "file" part (no "purpose" field like the public Files API).
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
          `Content-Type: ${mimeType}\r\n\r\n`,
      ),
      content,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])

    try {
      const response = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length.toString(),
        },
        timeout: UPLOAD_TIMEOUT_MS,
        signal: ctx.signal,
        validateStatus: () => true,
      })

      if (response.status !== 201) {
        debug(
          `upload failed for ${fullPath}: status=${response.status} body=${jsonStringify(response.data).slice(0, 200)}`,
        )
        return undefined
      }

      const parsed = uploadResponseSchema().safeParse(response.data)
      if (!parsed.success) {
        debug(
          `unexpected response shape for ${fullPath}: ${parsed.error.message}`,
        )
        return undefined
      }

      debug(`uploaded ${fullPath} → ${parsed.data.file_uuid} (${size} bytes)`)
      return parsed.data.file_uuid
    } catch (e) {
      debug(`upload threw for ${fullPath}: ${e}`)
      return undefined
    }
  }
  return undefined
}
