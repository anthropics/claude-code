export const API_BASE_URL = "https://www.googleapis.com/youtube/v3";

/** Google's OAuth 2.0 token endpoint, used to refresh access tokens. */
export const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Maximum characters in a single tool response before truncation kicks in. */
export const CHARACTER_LIMIT = 25_000;

/** Network timeout for a single API call, in milliseconds. */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Quota cost in units per call, keyed by endpoint. The free daily allowance is
 * 10,000 units. `search.list` is 100x more expensive than everything else,
 * which is why the search tool defaults to a small page size.
 */
export const QUOTA_COST: Record<string, number> = {
  search: 100,
  videos: 1,
  channels: 1,
  playlistItems: 1,
  commentThreads: 1,
  captions: 50,
};
