import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../constants.js";
import type { ApiErrorBody } from "../types.js";

/**
 * A YouTube Data API failure carrying the machine-readable `reason` Google
 * returns alongside the HTTP status. The reason is far more useful than the
 * status alone — a 403 can mean an exhausted quota, a key restriction, or a
 * disabled API, and each needs a different fix.
 */
export class YouTubeApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

function requireApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new YouTubeApiError(
      401,
      "missingApiKey",
      "YOUTUBE_API_KEY is not set. Export it in your shell profile, or pass it " +
        "via the `env` block of this server's .mcp.json entry.",
    );
  }
  return key;
}

/**
 * Call a YouTube Data API endpoint. Array values are joined with commas, which
 * is how the API expects repeated ids (e.g. `id=abc,def`), and undefined values
 * are dropped so callers can pass optional params through unconditionally.
 */
export async function ytRequest<T>(
  endpoint: string,
  params: Record<string, string | number | boolean | string[] | undefined>,
): Promise<T> {
  const url = new URL(`${API_BASE_URL}/${endpoint}`);
  url.searchParams.set("key", requireApiKey());

  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(name, Array.isArray(value) ? value.join(",") : String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new YouTubeApiError(
        408,
        "timeout",
        `Request to ${endpoint} timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`,
      );
    }
    throw new YouTubeApiError(
      0,
      "networkError",
      `Could not reach the YouTube Data API: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Non-JSON error body; fall through with an empty object.
    }
    const reason = body.error?.errors?.[0]?.reason ?? "unknown";
    throw new YouTubeApiError(
      response.status,
      reason,
      body.error?.message ?? response.statusText,
    );
  }

  return (await response.json()) as T;
}

/**
 * Turn any thrown value into an operator-facing message that says what to do
 * next. Every branch names a concrete fix rather than restating the status.
 */
export function describeError(error: unknown): string {
  if (error instanceof YouTubeApiError) {
    switch (error.reason) {
      case "missingApiKey":
        return `Error: ${error.message}`;
      case "quotaExceeded":
        return (
          "Error: The daily YouTube Data API quota (10,000 units) is exhausted. " +
          "It resets at midnight Pacific Time. Search costs 100 units per call " +
          "while most other endpoints cost 1 — prefer youtube_get_video_details " +
          "over repeated searches to conserve quota."
        );
      case "rateLimitExceeded":
      case "userRateLimitExceeded":
        return "Error: Sending requests too quickly. Wait a few seconds and retry.";
      case "keyInvalid":
        return (
          "Error: The API key is not valid. Check YOUTUBE_API_KEY for stray " +
          "whitespace or truncation — a Google API key is 39 characters and " +
          "starts with 'AIza'."
        );
      case "ipRefererBlocked":
        return (
          "Error: The API key's restrictions rejected this request. In Google Cloud " +
          "Console the key must allow YouTube Data API v3, and any HTTP-referrer or " +
          "IP restriction must permit the machine this server runs on."
        );
      case "accessNotConfigured":
        return (
          "Error: YouTube Data API v3 is not enabled for this key's project. Enable " +
          "it in Google Cloud Console under APIs & Services, then retry."
        );
      case "videoNotFound":
        return "Error: No video with that ID. Check the 11-character ID from the watch URL.";
      case "channelNotFound":
        return "Error: No channel with that ID. Channel IDs start with 'UC'.";
      case "playlistNotFound":
        return "Error: No playlist with that ID. Playlist IDs usually start with 'PL'.";
      case "commentsDisabled":
        return "Error: Comments are disabled on this video, so none can be listed.";
      case "timeout":
      case "networkError":
        return `Error: ${error.message}`;
      default:
        return `Error: YouTube API returned ${error.status} (${error.reason}): ${error.message}`;
    }
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
