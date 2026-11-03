import type { HttpResponse } from 'claude-code'

/**
 * The ingest's answer to a batch it will never take: not retried.
 */
export const REJECTED: HttpResponse = {
  status: 400,
  ok: false,
  headers: {},
  text: '',
}
