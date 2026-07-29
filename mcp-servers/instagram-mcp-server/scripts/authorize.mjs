#!/usr/bin/env node
/**
 * Authorization helper for instagram-mcp-server (Business Login for Instagram).
 *
 *   node scripts/authorize.mjs                 # print the authorization URL
 *   node scripts/authorize.mjs --code "<url-or-code>"   # exchange it for tokens
 *   node scripts/authorize.mjs --refresh       # extend a long-lived token 60 more days
 *
 * Why this is two steps rather than the one-shot loopback flow used for
 * YouTube: Meta validates redirect URIs by fetching them from its own servers,
 * so it rejects plain http:// URIs — including http://localhost. Registering an
 * https://localhost URI works, but the browser then lands on an SSL error page
 * because nothing is actually serving TLS there. The authorization code is
 * still in the address bar, so you copy it across by hand.
 *
 * Set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and INSTAGRAM_REDIRECT_URI first,
 * or pass them as --app-id / --app-secret / --redirect-uri.
 */

const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH_URL = "https://graph.instagram.com";

const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
].join(",");

function flag(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}
const has = (name) => process.argv.includes(`--${name}`);

const appId = flag("app-id") ?? process.env.INSTAGRAM_APP_ID;
const appSecret = flag("app-secret") ?? process.env.INSTAGRAM_APP_SECRET;
const redirectUri =
  flag("redirect-uri") ?? process.env.INSTAGRAM_REDIRECT_URI ?? "https://localhost:8573/callback";

function die(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

/**
 * Accept either a bare code or the whole redirect URL pasted from the address
 * bar. Meta appends a literal "#_" to the redirect that is not part of the
 * code; leaving it in causes an opaque HTTP 400 on exchange.
 */
function normalizeCode(raw) {
  let value = raw.trim();
  if (value.startsWith("http://") || value.startsWith("https://")) {
    const parsed = new URL(value);
    value = parsed.searchParams.get("code") ?? "";
    if (!value) die("That URL has no ?code= parameter. Copy the full address after authorizing.");
  }
  return value.replace(/#_+$/, "").replace(/\/+$/, "");
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text.slice(0, 400) };
  }
}

/** Fetch the account's id and username so the user does not have to look them up. */
async function describeAccount(token) {
  const url = new URL(`${GRAPH_URL}/me`);
  url.searchParams.set("fields", "id,username,account_type");
  url.searchParams.set("access_token", token);
  const response = await fetch(url);
  const body = await readJson(response);
  if (!response.ok) {
    console.error(
      `\nWarning: the token works for exchange but /me failed: ${JSON.stringify(body).slice(0, 200)}`,
    );
    return undefined;
  }
  return body;
}

function printExports(token, account, expiresInSeconds) {
  console.log("\nAdd these to your shell profile:\n");
  console.log(`export INSTAGRAM_ACCESS_TOKEN="${token}"`);
  if (account?.id) console.log(`export INSTAGRAM_ACCOUNT_ID="${account.id}"`);
  if (account?.username) console.log(`\n# account: @${account.username} (${account.account_type ?? "unknown type"})`);
  if (expiresInSeconds) {
    const days = Math.round(expiresInSeconds / 86400);
    console.log(
      `\nThis long-lived token expires in about ${days} days. Refresh it before then with:\n` +
        "  node scripts/authorize.mjs --refresh",
    );
  }
}

// --- refresh mode -----------------------------------------------------------
if (has("refresh")) {
  const existing = flag("token") ?? process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!existing) die("Set INSTAGRAM_ACCESS_TOKEN (or pass --token) to refresh it.");

  const url = new URL(`${GRAPH_URL}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", existing);

  const response = await fetch(url);
  const body = await readJson(response);
  if (!response.ok || !body.access_token) {
    die(
      `Refresh failed: ${JSON.stringify(body).slice(0, 300)}\n\n` +
        "A long-lived token can only be refreshed while it is still valid and at least 24 hours old. " +
        "If it has already expired, run the full flow again.",
    );
  }
  printExports(body.access_token, await describeAccount(body.access_token), body.expires_in);
  process.exit(0);
}

if (!appId || !appSecret) {
  die(
    "Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET (or pass --app-id / --app-secret).\n" +
      "Find them in the Meta App Dashboard under Instagram > API setup with Instagram login.",
  );
}

// --- step 2: exchange -------------------------------------------------------
const rawCode = flag("code");
if (rawCode) {
  const code = normalizeCode(rawCode);

  const shortResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const shortBody = await readJson(shortResponse);

  if (!shortResponse.ok || !shortBody.access_token) {
    die(
      `Exchanging the code failed: ${JSON.stringify(shortBody).slice(0, 400)}\n\n` +
        "Codes are single-use and expire after an hour, so the usual fix is to open the\n" +
        "authorization URL again for a fresh one. Also confirm --redirect-uri matches the\n" +
        "value registered in the App Dashboard exactly, including scheme, port, and path.",
    );
  }

  // Short-lived tokens last an hour; trade up immediately so the server does
  // not start with a credential that dies before it is first used.
  const longUrl = new URL(`${GRAPH_URL}/access_token`);
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("access_token", shortBody.access_token);

  const longResponse = await fetch(longUrl);
  const longBody = await readJson(longResponse);
  if (!longResponse.ok || !longBody.access_token) {
    die(`Exchanging for a long-lived token failed: ${JSON.stringify(longBody).slice(0, 400)}`);
  }

  const granted = Array.isArray(shortBody.permissions)
    ? shortBody.permissions.join(", ")
    : (shortBody.permissions ?? "(not reported)");
  console.log(`\nGranted permissions: ${granted}`);

  printExports(longBody.access_token, await describeAccount(longBody.access_token), longBody.expires_in);
  process.exit(0);
}

// --- step 1: print the authorization URL ------------------------------------
const authUrl = new URL(AUTHORIZE_URL);
authUrl.searchParams.set("client_id", appId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES);

console.log(`
Step 1 — open this URL and authorize with the Instagram professional account
you want this server to act as:

${authUrl}

Step 2 — the browser will land on ${redirectUri} and show an SSL error
("This site can't provide a secure connection"). That is expected: nothing is
serving TLS there, and Meta refuses to register a plain http:// redirect. The
authorization code is still in the address bar.

Copy the whole address, then run:

  node scripts/authorize.mjs --code "<paste the whole URL here>"

The code is single-use and expires in one hour. If the exchange fails, open the
URL above again for a fresh one rather than reusing it.
`);
