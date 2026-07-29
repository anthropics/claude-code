import {
  DEFAULT_API_VERSION,
  DEFAULT_HOST,
  REQUEST_TIMEOUT_MS,
} from "../constants.js";
import type { GraphErrorBody } from "../types.js";

/**
 * A Graph API failure. Meta returns a numeric `code`, an optional
 * `error_subcode`, and often an `error_user_msg` written for end users — the
 * last is usually the most actionable, so it is preserved separately.
 */
export class GraphApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: number,
    readonly subcode: number | undefined,
    message: string,
    readonly userMessage?: string,
  ) {
    super(message);
    this.name = "GraphApiError";
  }
}

function apiVersion(): string {
  return readEnv("INSTAGRAM_API_VERSION") ?? DEFAULT_API_VERSION;
}

function apiHost(): string {
  return readEnv("INSTAGRAM_API_HOST") ?? DEFAULT_HOST;
}

/**
 * Read an environment variable, treating an unexpanded `${VAR}` placeholder as
 * absent.
 *
 * A project-scoped .mcp.json passes credentials through as `"${VAR}"`. When the
 * variable is undefined in the client's environment, that literal string can
 * reach the server intact — non-empty, so a plain falsy check passes it
 * through, and it then gets sent as the credential. Meta answers with code 190,
 * which this client used to report as an expired token: exactly the wrong fix
 * for an unset variable.
 */
export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  if (/^\$\{.*\}$/.test(value.trim())) return undefined;
  return value;
}

function requireToken(): string {
  const token = readEnv("INSTAGRAM_ACCESS_TOKEN");
  if (!token) {
    throw new GraphApiError(
      401,
      0,
      undefined,
      "INSTAGRAM_ACCESS_TOKEN is not set. Generate a long-lived Instagram User " +
        "access token (Instagram Login) or Page access token (Facebook Login) in " +
        "the Meta App Dashboard, then export it before starting this server.",
    );
  }
  return token;
}

/** The Instagram professional account ID all account-scoped calls hang off. */
export function requireAccountId(): string {
  const id = readEnv("INSTAGRAM_ACCOUNT_ID");
  if (!id) {
    throw new GraphApiError(
      400,
      0,
      undefined,
      "INSTAGRAM_ACCOUNT_ID is not set. It is the numeric Instagram professional " +
        "account ID — call instagram_get_account with account_id='me' to discover it, " +
        "then export it so the other tools can default to it.",
    );
  }
  return id;
}

async function graphRequest<T>(
  path: string,
  method: "GET" | "POST" | "DELETE",
  params: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`https://${apiHost()}/${apiVersion()}/${path}`);
  const token = requireToken();

  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(name, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const init: RequestInit = {
    method,
    signal: controller.signal,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  if (method === "GET" || method === "DELETE") {
    url.search = search.toString();
  } else {
    // Parameters go in the body on writes so long captions do not blow the
    // URL length limit.
    init.body = search;
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GraphApiError(
        408,
        0,
        undefined,
        `Request to ${path} timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`,
      );
    }
    throw new GraphApiError(
      0,
      0,
      undefined,
      `Could not reach the Graph API: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new GraphApiError(
      response.status,
      0,
      undefined,
      `Graph API returned a non-JSON response (HTTP ${response.status}): ${text.slice(0, 200)}`,
    );
  }

  if (!response.ok) {
    const error = (body as GraphErrorBody).error ?? {};
    throw new GraphApiError(
      response.status,
      error.code ?? 0,
      error.error_subcode,
      error.message ?? response.statusText,
      error.error_user_msg ?? error.error_user_title,
    );
  }

  return body as T;
}

export function graphGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  return graphRequest<T>(path, "GET", params);
}

export function graphPost<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  return graphRequest<T>(path, "POST", params);
}

/**
 * Turn a Graph API failure into a message naming the fix. Meta's numeric codes
 * are stable across versions and far more specific than the HTTP status, which
 * is almost always 400.
 */
export function describeError(error: unknown): string {
  if (error instanceof GraphApiError) {
    // Meta's own user-facing text, when present, beats anything generic.
    const suffix = error.userMessage ? ` Meta says: "${error.userMessage}"` : "";

    switch (error.code) {
      case 0:
        return `Error: ${error.message}`;
      case 190:
        return (
          "Error: The access token is invalid or has expired. Instagram User tokens " +
          "last 60 days and must be refreshed before expiry; a token generated in the " +
          "Graph API Explorer without exchanging it for a long-lived one expires in about " +
          `an hour. Regenerate it in the Meta App Dashboard.${suffix}`
        );
      case 4:
      case 17:
      case 32:
        return (
          "Error: Rate limit reached. The Instagram Graph API allows roughly 200 calls " +
          `per user per hour. Wait for the window to roll over before retrying.${suffix}`
        );
      case 10:
      case 200:
        return (
          "Error: The token lacks the permission this call needs. Check the app's granted " +
          "scopes — reading needs instagram_business_basic, comments need " +
          "instagram_business_manage_comments, publishing needs " +
          "instagram_business_content_publish, and insights need " +
          `instagram_business_manage_insights.${suffix}`
        );
      case 100:
        return (
          `Error: The Graph API rejected a parameter: ${error.message}. Check that the ID ` +
          `belongs to the authenticated account and that requested fields exist in ` +
          `${apiVersion()}.${suffix}`
        );
      case 803:
        return (
          "Error: No object with that ID is visible to this token. Instagram IDs are " +
          `scoped to the account that owns them.${suffix}`
        );
      case 9007:
        return (
          "Error: The publishing limit is exhausted. Instagram allows 100 API-published " +
          "posts per rolling 24 hours. Call instagram_get_publishing_limit to see current " +
          `usage.${suffix}`
        );
      default:
        return `Error: Graph API code ${error.code}${
          error.subcode ? `/${error.subcode}` : ""
        }: ${error.message}${suffix}`;
    }
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
