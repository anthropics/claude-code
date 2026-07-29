/**
 * Graph API version. v25.0 was introduced 2026-02-18 and is supported until
 * 2028-07-29. Override with INSTAGRAM_API_VERSION when Meta ships a newer one.
 */
export const DEFAULT_API_VERSION = "v25.0";

/**
 * Host depends on which login flow the app uses:
 *
 *   graph.instagram.com — Instagram API with Instagram Login (Instagram User
 *                         access token, `instagram_business_*` permissions)
 *   graph.facebook.com  — Instagram API with Facebook Login (Page access token,
 *                         `instagram_*` + `pages_read_engagement` permissions)
 *
 * Both expose the same paths, so the only difference here is the host and the
 * token you supply.
 */
export const DEFAULT_HOST = "graph.instagram.com";

export const CHARACTER_LIMIT = 25_000;
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Instagram allows 100 API-published posts per rolling 24 hours, enforced on
 * media_publish. Carousels count as one. Read current usage with
 * instagram_get_publishing_limit.
 */
export const PUBLISH_LIMIT_PER_DAY = 100;

/** How long to wait between container status polls when publishing video. */
export const CONTAINER_POLL_INTERVAL_MS = 3_000;

/** Maximum polls before giving up on a container that never finishes. */
export const CONTAINER_POLL_ATTEMPTS = 20;
