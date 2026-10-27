import type { Args } from 'claude-code'

import type { IngestBatch } from './ingest-batch.js'

/**
 * The batch a post to the ingest carries, as it was sent.
 *
 * @param post the `http.fetch` the plugin made
 * @returns the body, parsed
 */
export const batchOf = (post: Args<'http.fetch'>): IngestBatch =>
  JSON.parse(String(post.init?.body))
