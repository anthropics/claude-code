#!/usr/bin/env node
/**
 * MCP server for the YouTube Data API v3.
 *
 * Exposes search, video and channel metadata, playlists, comments, caption
 * track listings, and transcripts over stdio.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerChannelTools } from "./tools/channels.js";
import { registerEngagementTools } from "./tools/engagement.js";
import { registerVideoTools } from "./tools/videos.js";

const server = new McpServer({
  name: "youtube-mcp-server",
  version: "1.0.0",
});

registerVideoTools(server);
registerChannelTools(server);
registerEngagementTools(server);

async function main(): Promise<void> {
  if (!process.env.YOUTUBE_API_KEY) {
    // Warn but keep serving: youtube_get_transcript does not use the Data API,
    // and failing fast here would make the whole server look broken.
    console.error(
      "WARNING: YOUTUBE_API_KEY is not set. Every tool except youtube_get_transcript will " +
        "return an authentication error until it is.",
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout carries the JSON-RPC stream, so all logging goes to stderr.
  console.error("youtube-mcp-server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error starting youtube-mcp-server:", error);
  process.exit(1);
});
