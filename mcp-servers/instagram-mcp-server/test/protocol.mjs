#!/usr/bin/env node
/**
 * Protocol-level test for instagram-mcp-server.
 *
 * SCOPE: this deliberately does NOT talk to the Graph API. It verifies the
 * layers that do not need credentials — tool registration, schema validation,
 * and the pre-flight error paths — by running the server with no token set.
 *
 * The Graph API request/response handling is therefore UNVERIFIED. See README.
 *
 *   node test/protocol.mjs
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

const EXPECTED_TOOLS = [
  "instagram_get_account",
  "instagram_get_account_insights",
  "instagram_get_media",
  "instagram_get_media_insights",
  "instagram_get_publishing_limit",
  "instagram_list_comments",
  "instagram_list_media",
  "instagram_publish_post",
  "instagram_reply_to_comment",
];

// Run with credentials explicitly stripped so the auth guard is what fires.
const env = { ...process.env };
delete env.INSTAGRAM_ACCESS_TOKEN;
delete env.INSTAGRAM_ACCOUNT_ID;

const child = spawn("node", [serverPath], { stdio: ["pipe", "pipe", "pipe"], env });
child.stderr.on("data", () => {}); // startup warnings are expected here

let buffer = "";
const pending = new Map();
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    try {
      const message = JSON.parse(line);
      const resolve = pending.get(message.id);
      if (resolve) {
        pending.delete(message.id);
        resolve(message);
      }
    } catch {
      /* ignore non-JSON lines */
    }
  }
});

let nextId = 1;
function send(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 20_000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

const results = [];
function assert(label, condition, detail = "") {
  results.push({ label, ok: Boolean(condition) });
  console.log(`${condition ? "ok   " : "FAIL "} ${label}${condition ? "" : ` — ${detail}`}`);
}

async function main() {
  const init = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "protocol-test", version: "1.0.0" },
  });
  assert("server initializes", init.result?.serverInfo?.name === "instagram-mcp-server");
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

  const list = await send("tools/list", {});
  const tools = list.result.tools;
  const names = tools.map((tool) => tool.name).sort();
  assert(
    `registers all ${EXPECTED_TOOLS.length} tools`,
    JSON.stringify(names) === JSON.stringify(EXPECTED_TOOLS),
    names.join(","),
  );

  for (const tool of tools) {
    assert(
      `${tool.name} has description, schema, annotations`,
      Boolean(tool.description) && Boolean(tool.inputSchema) && Boolean(tool.annotations),
    );
  }

  const writeTools = ["instagram_publish_post", "instagram_reply_to_comment"];
  for (const tool of tools) {
    const expectReadOnly = !writeTools.includes(tool.name);
    assert(
      `${tool.name} readOnlyHint is ${expectReadOnly}`,
      tool.annotations.readOnlyHint === expectReadOnly,
      `got ${tool.annotations.readOnlyHint}`,
    );
  }

  // Missing token must surface as a clean in-band error, not a crash.
  const noToken = await send("tools/call", {
    name: "instagram_get_account",
    arguments: { account_id: "me" },
  });
  const noTokenText = noToken.result?.content?.[0]?.text ?? "";
  assert(
    "missing token yields a clean, actionable error",
    noToken.result?.isError === true && noTokenText.includes("INSTAGRAM_ACCESS_TOKEN"),
    noTokenText.slice(0, 120),
  );

  // Missing account ID is a distinct, separately actionable failure.
  const noAccount = await send("tools/call", {
    name: "instagram_list_media",
    arguments: {},
  });
  const noAccountText = noAccount.result?.content?.[0]?.text ?? "";
  assert(
    "missing account id is reported distinctly",
    noAccount.result?.isError === true &&
      (noAccountText.includes("INSTAGRAM_ACCOUNT_ID") ||
        noAccountText.includes("INSTAGRAM_ACCESS_TOKEN")),
    noAccountText.slice(0, 120),
  );

  // Zod must reject a non-numeric Instagram ID before any network call.
  const badId = await send("tools/call", {
    name: "instagram_get_media",
    arguments: { media_id: "not-a-number" },
  });
  assert(
    "schema rejects a non-numeric media id",
    Boolean(badId.error) || badId.result?.isError === true,
  );

  // Publishing with neither URL is caught locally, before touching the API.
  const noMedia = await send("tools/call", {
    name: "instagram_publish_post",
    arguments: { caption: "hello" },
  });
  const noMediaText = noMedia.result?.content?.[0]?.text ?? "";
  assert(
    "publish without media is rejected locally",
    noMedia.result?.isError === true && noMediaText.includes("image_url or video_url"),
    noMediaText.slice(0, 120),
  );

  // Supplying both is ambiguous and must also be caught locally.
  const bothMedia = await send("tools/call", {
    name: "instagram_publish_post",
    arguments: {
      image_url: "https://example.com/a.jpg",
      video_url: "https://example.com/a.mp4",
    },
  });
  const bothText = bothMedia.result?.content?.[0]?.text ?? "";
  assert(
    "publish with both image and video is rejected locally",
    bothMedia.result?.isError === true && bothText.includes("exactly one"),
    bothText.slice(0, 120),
  );

  const failures = results.filter((entry) => !entry.ok);
  console.log(`\n${results.length - failures.length}/${results.length} passed`);
  console.log(
    "\nNOTE: Graph API request/response handling is NOT covered here — it needs " +
      "real Meta credentials. See README.",
  );
  child.kill();
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  child.kill();
  process.exit(1);
});
