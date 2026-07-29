import { REQUEST_TIMEOUT_MS, TOKEN_URL } from "../constants.js";
import { YouTubeApiError } from "./client.js";

/**
 * Scope required by captions.download. The read-only youtube.readonly scope is
 * NOT sufficient — Google requires force-ssl to return caption text.
 */
export const CAPTIONS_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cached: CachedToken | undefined;

export function oauthConfigured(): boolean {
  return Boolean(
    process.env.YOUTUBE_OAUTH_CLIENT_ID &&
      process.env.YOUTUBE_OAUTH_CLIENT_SECRET &&
      process.env.YOUTUBE_OAUTH_REFRESH_TOKEN,
  );
}

/** Names of whichever OAuth variables are missing, for error messages. */
export function missingOAuthVars(): string[] {
  return [
    "YOUTUBE_OAUTH_CLIENT_ID",
    "YOUTUBE_OAUTH_CLIENT_SECRET",
    "YOUTUBE_OAUTH_REFRESH_TOKEN",
  ].filter((name) => !process.env[name]);
}

/**
 * Exchange the stored refresh token for an access token.
 *
 * Access tokens last an hour; the refresh token is long-lived. The result is
 * cached in memory with a 60-second safety margin so a long tool call cannot
 * expire mid-flight, and so a burst of caption downloads costs one exchange
 * rather than one per call.
 */
export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.accessToken;

  const missing = missingOAuthVars();
  if (missing.length) {
    throw new YouTubeApiError(
      401,
      "oauthNotConfigured",
      `OAuth is not configured — missing ${missing.join(", ")}. Run ` +
        "`node scripts/authorize.mjs` in the server directory to obtain a refresh token, " +
        "then export the three variables it prints.",
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: process.env.YOUTUBE_OAUTH_REFRESH_TOKEN as string,
    client_id: process.env.YOUTUBE_OAUTH_CLIENT_ID as string,
    client_secret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET as string,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      body,
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch (error) {
    throw new YouTubeApiError(
      0,
      "networkError",
      `Could not reach Google's token endpoint: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    clearTimeout(timer);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    // invalid_grant is the common one and has specific causes worth naming.
    const detail = payload.error_description ?? payload.error ?? response.statusText;
    if (payload.error === "invalid_grant") {
      throw new YouTubeApiError(
        401,
        "refreshTokenRejected",
        "The refresh token was rejected. This happens when the token has been revoked, " +
          "when the OAuth consent screen is still in Testing mode (those refresh tokens " +
          "expire after 7 days), or when the password on the Google account changed. " +
          "Re-run `node scripts/authorize.mjs` to obtain a new one.",
      );
    }
    throw new YouTubeApiError(
      response.status,
      "tokenExchangeFailed",
      `Could not exchange the refresh token for an access token: ${detail}`,
    );
  }

  cached = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(0, (payload.expires_in ?? 3600) - 60) * 1000,
  };
  return cached.accessToken;
}

/** Drop the cached access token. Exported for tests. */
export function resetTokenCache(): void {
  cached = undefined;
}
