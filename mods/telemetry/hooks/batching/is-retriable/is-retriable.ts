import { STATUS_REQUEST_TIMEOUT } from './status-request-timeout'
import { STATUS_SERVER_ERROR } from './status-server-error'
import { STATUS_TOO_MANY_REQUESTS } from './status-too-many-requests'

/**
 * Whether an answer from the ingest is worth the one retry: a server error,
 * a timeout or a rate limit; anything else it refused stays refused.
 *
 * @param status the HTTP status the ingest answered
 * @returns true for 5xx, 408 and 429
 */
export const isRetriable = (status: number) =>
  status >= STATUS_SERVER_ERROR ||
  status === STATUS_REQUEST_TIMEOUT ||
  status === STATUS_TOO_MANY_REQUESTS
