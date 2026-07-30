#!/usr/bin/env node
/**
 * End-to-end smoke test for youtube-mcp-server.
 *
 * Speaks JSON-RPC over stdio to a real server process and calls every tool
 * against the live YouTube Data API, so a pass means the tool actually works
 * rather than merely compiling.
 *
 *   YOUTUBE_API_KEY=... node test/smoke.mjs
 *
 * Exits non-zero if any case fails. Every call is read-only.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// A closed stdout is normal when piping to `head` or `grep -m`. Without this,
// Node raises an unhandled EPIPE that looks like a test failure.
process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(0);
});

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, "..", "dist", "index.js");

// Stable, long-lived public references. "Me at the zoo" is the first YouTube
// video and is not going anywhere; the channel is YouTube's own.
const VIDEO_ID = "jNQXAC9IVRw";
const CHANNEL_HANDLE = "@YouTube";

if (!process.env.YOUTUBE_API_KEY) {
  console.error("YOUTUBE_API_KEY is not set — the Data API cases would all fail.");
  process.exit(2);
}

const child = spawn("node", [serverPath], {
  stdio: ["pipe", "pipe", "pipe"],
  env: process.env,
});

child.stderr.on("data", (chunk) => {
  const line = String(chunk).trim();
  if (line && !line.includes("running on stdio")) console.error(`[server] ${line}`);
});

let buffer = "";
const pending = new Map();

child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  }
});

let nextId = 1;
function send(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out after 60s`));
    }, 60_000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

/** A tool result counts as a failure when it sets isError or returns "Error:" text. */
function toolFailed(message) {
  if (message.error) return message.error.message ?? "protocol error";
  const result = message.result ?? {};
  if (result.isError) return result.content?.[0]?.text ?? "isError with no text";
  const text = result.content?.[0]?.text ?? "";
  if (text.startsWith("Error:")) return text;
  return null;
}

function preview(message) {
  const text = message.result?.content?.[0]?.text ?? "";
  return text.replace(/\s+/g, " ").slice(0, 110);
}

const results = [];

/**
 * Every video row must carry a real 11-character video ID.
 *
 * Without this, a tool can return well-formed output whose IDs and URLs are
 * useless — which is exactly what happened when playlistItems' entry ID was
 * mistaken for the video ID. The response looked correct; every link was dead.
 */
function badVideoIds(message) {
  const rows = message.result?.structuredContent?.videos;
  if (!Array.isArray(rows)) return null;
  const bad = rows.map((row) => row.id).filter((id) => !/^[A-Za-z0-9_-]{11}$/.test(id ?? ""));
  return bad.length ? `malformed video ids: ${bad.slice(0, 3).join(", ")}` : null;
}

async function check(label, toolName, args) {
  const message = await send("tools/call", { name: toolName, arguments: args });
  const failure = toolFailed(message) ?? badVideoIds(message);
  results.push({ label, failure });
  if (failure) {
    console.log(`FAIL  ${label}\n      ${failure.replace(/\s+/g, " ").slice(0, 200)}`);
  } else {
    console.log(`ok    ${label}\n      ${preview(message)}`);
  }
}

async function main() {
  const init = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "1.0.0" },
  });
  console.log(`server: ${init.result.serverInfo.name} v${init.result.serverInfo.version}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

  const list = await send("tools/list", {});
  const tools = list.result.tools.map((tool) => tool.name).sort();
  console.log(`${tools.length} tools: ${tools.join(", ")}\n`);

  // Pinned so the surface cannot drift unnoticed. youtube_get_transcript is
  // OAuth-only and works solely on the authorizing account's own uploads; the
  // API-key path cannot download caption text at all.
  const EXPECTED = [
    "youtube_get_channel",
    "youtube_get_transcript",
    "youtube_get_trending_videos",
    "youtube_get_video_details",
    "youtube_list_caption_tracks",
    "youtube_list_channel_videos",
    "youtube_list_playlist_items",
    "youtube_list_video_comments",
    "youtube_search_videos",
  ];
  const surfaceMatches = JSON.stringify(tools) === JSON.stringify(EXPECTED);
  results.push({ label: "tool surface matches expectation", failure: surfaceMatches ? null : tools.join(",") });
  console.log(`${surfaceMatches ? "ok   " : "FAIL "} tool surface matches expectation\n`);

  await check("search_videos", "youtube_search_videos", {
    query: "model context protocol",
    limit: 2,
  });
  await check("search_videos (no stats)", "youtube_search_videos", {
    query: "claude code",
    limit: 2,
    include_statistics: false,
    response_format: "json",
  });
  await check("get_video_details", "youtube_get_video_details", { video_ids: [VIDEO_ID] });
  await check("get_video_details (missing id)", "youtube_get_video_details", {
    video_ids: [VIDEO_ID, "aaaaaaaaaaa"],
  });
  await check("get_trending_videos (TR)", "youtube_get_trending_videos", {
    region_code: "TR",
    limit: 3,
  });
  await check("get_channel (handle)", "youtube_get_channel", { channel: CHANNEL_HANDLE });
  await check("list_channel_videos", "youtube_list_channel_videos", {
    channel: CHANNEL_HANDLE,
    limit: 3,
  });
  await check("list_video_comments", "youtube_list_video_comments", {
    video_id: VIDEO_ID,
    limit: 3,
  });
  await check("list_caption_tracks", "youtube_list_caption_tracks", { video_id: VIDEO_ID });

  // Negative cases: these must fail cleanly with a useful message, not crash.
  const badId = await send("tools/call", {
    name: "youtube_get_channel",
    arguments: { channel: "UCzzzzzzzzzzzzzzzzzzzzzz" },
  });
  const badIdFailed = Boolean(toolFailed(badId));
  results.push({ label: "get_channel (unknown id rejected)", failure: badIdFailed ? null : "expected an error" });
  console.log(`${badIdFailed ? "ok   " : "FAIL "} get_channel (unknown id rejected)`);

  // Without OAuth the transcript tool must name the missing variables rather
  // than failing generically — that message is the whole setup instruction.
  const noOauth = await send("tools/call", {
    name: "youtube_get_transcript",
    arguments: { video_id: VIDEO_ID },
  });
  const noOauthText = noOauth.result?.content?.[0]?.text ?? "";
  const oauthWasConfigured = Boolean(process.env.YOUTUBE_OAUTH_REFRESH_TOKEN);
  const oauthMessageOk =
    oauthWasConfigured ||
    (noOauth.result?.isError === true &&
      noOauthText.includes("YOUTUBE_OAUTH_CLIENT_ID") &&
      noOauthText.includes("authorize.mjs"));
  results.push({
    label: oauthWasConfigured
      ? "transcript tool reachable (OAuth configured, result not asserted)"
      : "transcript without OAuth names the missing variables",
    failure: oauthMessageOk ? null : noOauthText.slice(0, 160),
  });
  console.log(
    `${oauthMessageOk ? "ok   " : "FAIL "} ${
      oauthWasConfigured
        ? "transcript tool reachable (OAuth configured)"
        : "transcript without OAuth names the missing variables"
    }`,
  );

  const badSchema = await send("tools/call", {
    name: "youtube_get_video_details",
    arguments: { video_ids: ["too-short"] },
  });
  const schemaRejected = Boolean(badSchema.error || badSchema.result?.isError);
  results.push({ label: "schema rejects malformed id", failure: schemaRejected ? null : "expected validation to reject" });
  console.log(`${schemaRejected ? "ok   " : "FAIL "} schema rejects malformed id`);

  const failures = results.filter((entry) => entry.failure);
  console.log(`\n${results.length - failures.length}/${results.length} passed`);
  child.kill();
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  child.kill();
  process.exit(1);
});
