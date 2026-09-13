import type { HttpResponse } from 'claude-code'

/**
 * The ingest's answer while it is down.
 */
export const REFUSED: HttpResponse = {
  status: 500,
  ok: false,
  headers: {},
  text: '',
}
