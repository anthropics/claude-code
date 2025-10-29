#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Octokit } from "@octokit/rest";

const githubToken = process.env.GITHUB_TOKEN;

if (!githubToken) {
  throw new Error("GITHUB_TOKEN environment variable is required");
}

// Basic token sanitization to prevent accidental token leakage
function sanitizeContent(content: string): string {
  // Redact common GitHub token patterns
  const patterns = [
    /ghp_[a-zA-Z0-9]{36}/g, // Personal access tokens
    /gho_[a-zA-Z0-9]{36}/g, // OAuth tokens
    /ghs_[a-zA-Z0-9]{36}/g, // Installation tokens
    /ghr_[a-zA-Z0-9]{36}/g, // Refresh tokens
    /github_pat_[a-zA-Z0-9_]{82}/g, // Fine-grained personal access tokens
  ];

  let sanitized = content;
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, "[REDACTED_TOKEN]");
  }
  return sanitized;
}

// GitHub Inline Comment MCP Server - Provides inline PR comment functionality
const server = new McpServer({
  name: "GitHub Inline Comment Server",
  version: "0.0.1",
});

server.tool(
  "create_inline_comment",
  "Create an inline comment on a specific line or lines in a PR file. Use this tool to provide code suggestions or feedback directly in the PR diff.",
  {
    owner: z.string().describe("Repository owner (e.g., 'anthropics')"),
    repo: z.string().describe("Repository name (e.g., 'claude-code-action')"),
    pull_number: z
      .number()
      .positive()
      .describe("Pull request number (e.g., 42)"),
    path: z
      .string()
      .describe("The file path to comment on (e.g., 'src/index.js')"),
    body: z
      .string()
      .describe(
        "The comment text (supports markdown and GitHub code suggestion blocks). " +
          "For code suggestions, use: ```suggestion\\nreplacement code\\n```. " +
          "IMPORTANT: The suggestion block will REPLACE the ENTIRE line range (single line or startLine to line). " +
          "Ensure the replacement is syntactically complete and valid - it must work as a drop-in replacement for the selected lines."
      ),
    line: z
      .number()
      .nonnegative()
      .optional()
      .describe(
        "Line number for single-line comments (required if startLine is not provided)"
      ),
    startLine: z
      .number()
      .nonnegative()
      .optional()
      .describe(
        "Start line for multi-line comments (use with line parameter for the end line)"
      ),
    side: z
      .enum(["LEFT", "RIGHT"])
      .optional()
      .default("RIGHT")
      .describe(
        "Side of the diff to comment on: LEFT (old code) or RIGHT (new code)"
      ),
    commit_id: z
      .string()
      .optional()
      .describe(
        "Specific commit SHA to comment on (defaults to latest commit)"
      ),
  },
  async ({
    owner,
    repo,
    pull_number,
    path,
    body,
    line,
    startLine,
    side,
    commit_id,
  }) => {
    try {
      const octokit = new Octokit({ auth: githubToken });

      // Sanitize the comment body to remove any potential GitHub tokens
      const sanitizedBody = sanitizeContent(body);

      // Validate that either line or both startLine and line are provided
      if (!line && !startLine) {
        throw new Error(
          "Either 'line' for single-line comments or both 'startLine' and 'line' for multi-line comments must be provided"
        );
      }

      // If only line is provided, it's a single-line comment
      // If both startLine and line are provided, it's a multi-line comment
      const isSingleLine = !startLine;

      const pr = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number,
      });

      const params: Parameters<
        typeof octokit.rest.pulls.createReviewComment
      >[0] = {
        owner,
        repo,
        pull_number,
        body: sanitizedBody,
        path,
        side: side || "RIGHT",
        commit_id: commit_id || pr.data.head.sha,
      };

      if (isSingleLine) {
        // Single-line comment
        params.line = line;
      } else {
        // Multi-line comment
        params.start_line = startLine;
        params.start_side = side || "RIGHT";
        params.line = line;
      }

      const result = await octokit.rest.pulls.createReviewComment(params);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                comment_id: result.data.id,
                html_url: result.data.html_url,
                path: result.data.path,
                line: result.data.line || result.data.original_line,
                message: `Inline comment created successfully on ${path}${
                  isSingleLine
                    ? ` at line ${line}`
                    : ` from line ${startLine} to ${line}`
                }`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Provide more helpful error messages for common issues
      let helpMessage = "";
      if (errorMessage.includes("Validation Failed")) {
        helpMessage =
          "\n\nThis usually means the line number doesn't exist in the diff or the file path is incorrect. Make sure you're commenting on lines that are part of the PR's changes.";
      } else if (errorMessage.includes("Not Found")) {
        helpMessage =
          "\n\nThis usually means the PR number, repository, or file path is incorrect.";
      }

      return {
        content: [
          {
            type: "text",
            text: `Error creating inline comment: ${errorMessage}${helpMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  }
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on("exit", () => {
    server.close();
  });
}

runServer().catch(console.error);
