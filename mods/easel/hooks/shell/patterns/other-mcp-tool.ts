/**
 * A tool of another MCP server, whose results may be charted unasked.
 *
 * An artifact's publish never answers with metrics.
 */
export const OTHER_MCP_TOOL =
  /^mcp__(?!easel__|claude-artifacts__publish_files$)/
