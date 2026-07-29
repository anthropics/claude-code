#!/usr/bin/env node
/**
 * One-time OAuth authorization for youtube_get_transcript.
 *
 *   node scripts/authorize.mjs
 *
 * Runs Google's installed-application flow: opens a consent page in your
 * browser, catches the redirect on a loopback port, and exchanges the code for
 * a refresh token. Prints the three exports the server needs. Nothing is
 * written to disk — the refresh token is a credential and belongs in your shell
 * profile or secret store, not in the repo.
 *
 * Before running, create the client in Google Cloud Console:
 *   APIs & Services -> Credentials -> Create credentials -> OAuth client ID
 *   Application type: Desktop app
 * Then set YOUTUBE_OAUTH_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET, or pass
 * them as the first two arguments.
 */

import { createServer } from "node:http";
import { createInterface } from "node:readline/promises";
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

const clientId = process.argv[2] ?? process.env.YOUTUBE_OAUTH_CLIENT_ID ?? (await ask("OAuth client ID: "));
const clientSecret =
  process.argv[3] ?? process.env.YOUTUBE_OAUTH_CLIENT_SECRET ?? (await ask("OAuth client secret: "));

if (!clientId || !clientSecret) {
  console.error("Both a client ID and a client secret are required.");
  process.exit(1);
}

// Bind to port 0 so the OS picks a free port, then build the redirect URI from
// whatever it gave us. Google permits any loopback port for Desktop clients.
const server = createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const redirectUri = `http://127.0.0.1:${port}`;

const authUrl = new URL(AUTH_URL);
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
// offline + consent is what actually yields a refresh token; without prompt=consent
// Google omits it on any authorization after the first for the same client.
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\nAuthorize with the Google account that OWNS the videos you want transcripts for.");
console.log("Any other account will authorize fine and then return 403 on download.\n");
console.log(`${authUrl}\n`);

// Best-effort browser launch; the URL is printed above either way.
const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
spawn(opener, [authUrl.toString()], { stdio: "ignore", detached: true }).unref();

const code = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Timed out after 5 minutes waiting for consent.")), 300_000);
  server.on("request", (req, res) => {
    const url = new URL(req.url, redirectUri);
    const received = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(received ? "Authorized. You can close this tab." : `Authorization failed: ${error}`);
    clearTimeout(timer);
    server.close();
    if (received) resolve(received);
    else reject(new Error(`Google returned: ${error ?? "no code"}`));
  });
});

const response = await fetch(TOKEN_URL, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  }),
});

const payload = await response.json();
if (!response.ok || !payload.refresh_token) {
  console.error("\nToken exchange failed.");
  console.error(JSON.stringify(payload, null, 2));
  if (response.ok && !payload.refresh_token) {
    console.error(
      "\nGoogle returned an access token but no refresh token. That happens when this client " +
        "was already authorized — revoke it at https://myaccount.google.com/permissions and retry.",
    );
  }
  process.exit(1);
}

const exports = [
  `export YOUTUBE_OAUTH_CLIENT_ID="${clientId}"`,
  `export YOUTUBE_OAUTH_CLIENT_SECRET="${clientSecret}"`,
  `export YOUTUBE_OAUTH_REFRESH_TOKEN="${payload.refresh_token}"`,
];

if (process.argv.includes("--write")) {
  // Printing alone leaves persistence to a manual copy, and a refresh token
  // that only reached stdout dies with the terminal window — after which a
  // completed authorization looks like a broken one.
  const shell = (process.env.SHELL ?? "/bin/sh").split("/").pop();
  const target =
    shell === "zsh"
      ? join(homedir(), ".zshrc")
      : shell === "bash"
        ? join(homedir(), ".bashrc")
        : join(homedir(), ".profile");

  const existing = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (existing.includes("YOUTUBE_OAUTH_REFRESH_TOKEN")) {
    console.log(`\n${target} already sets YOUTUBE_OAUTH_REFRESH_TOKEN. Update that line by hand.`);
  } else {
    appendFileSync(target, `\n# youtube-mcp-server OAuth\n${exports.join("\n")}\n`);
    console.log(`\nWritten to ${target}. Run: source ${target}`);
    console.log("Then restart Claude Code — MCP servers read the environment at startup.");
  }
} else {
  console.log("\nAdd these to your shell profile (or re-run with --write):\n");
  for (const line of exports) console.log(line);
}
console.log(
  "\nIf the OAuth consent screen is still in Testing mode, this refresh token expires in 7 days.\n" +
    "Publish the app in Google Cloud Console to get a long-lived one.\n",
);
