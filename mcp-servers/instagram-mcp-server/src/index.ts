#!/usr/bin/env node
/**
 * MCP server for the Instagram Graph API.
 *
 * Covers profile and media reads, comment moderation, insights, and content
 * publishing for Instagram professional (Business or Creator) accounts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DEFAULT_API_VERSION, DEFAULT_HOST } from "./constants.js";
import { readEnv } from "./services/client.js";
import { registerAccountTools } from "./tools/account.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerInsightTools } from "./tools/insights.js";
import { registerMediaTools } from "./tools/media.js";

const server = new McpServer({
  name: "instagram-mcp-server",
  version: "1.0.0",
});

registerAccountTools(server);
registerMediaTools(server);
registerCommentTools(server);
registerInsightTools(server);

async function main(): Promise<void> {
  if (!readEnv("INSTAGRAM_ACCESS_TOKEN")) {
    console.error(
      "WARNING: INSTAGRAM_ACCESS_TOKEN is not set. Every tool will return an " +
        "authentication error until it is.",
    );
  }
  if (!readEnv("INSTAGRAM_ACCOUNT_ID")) {
    console.error(
      "NOTE: INSTAGRAM_ACCOUNT_ID is not set. Call instagram_get_account with " +
        "account_id='me' to discover it, then export it so other tools can default to it.",
    );
  }

  const host = readEnv("INSTAGRAM_API_HOST") ?? DEFAULT_HOST;
  const version = readEnv("INSTAGRAM_API_VERSION") ?? DEFAULT_API_VERSION;

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout carries the JSON-RPC stream, so logging goes to stderr.
  console.error(`instagram-mcp-server running on stdio (${host}/${version})`);
}

main().catch((error: unknown) => {
  console.error("Fatal error starting instagram-mcp-server:", error);
  process.exit(1);
});
