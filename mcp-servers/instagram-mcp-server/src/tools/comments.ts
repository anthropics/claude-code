import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { describeError, graphGet, graphPost } from "../services/client.js";
import { errorResult, formatCount, formatTimestamp, respond, truncateText } from "../services/format.js";
import { afterParam, instagramIdParam, limitParam, responseFormatParam } from "../schemas.js";
import type { CommentObject, GraphListResponse } from "../types.js";

const COMMENT_FIELDS = "id,text,timestamp,username,like_count,hidden";

interface CommentRow {
  id: string;
  username: string;
  text: string;
  like_count: number;
  hidden: boolean;
  timestamp: string;
  reply_count?: number;
}

function toCommentRow(comment: CommentObject): CommentRow {
  return {
    id: comment.id ?? "",
    username: comment.username ?? comment.from?.username ?? "(unknown)",
    text: comment.text ?? "",
    like_count: comment.like_count ?? 0,
    hidden: comment.hidden === true,
    timestamp: comment.timestamp ?? "",
    ...(comment.replies?.data ? { reply_count: comment.replies.data.length } : {}),
  };
}

function renderComments(heading: string, rows: CommentRow[], nextCursor?: string): string {
  const lines = [`# ${heading}`, "", `Showing ${rows.length}`, ""];
  for (const row of rows) {
    lines.push(`## @${row.username}${row.hidden ? " _(hidden)_" : ""}`);
    lines.push(
      `- ${formatCount(row.like_count)} likes · ${formatTimestamp(row.timestamp)} · ID ${row.id}`,
    );
    lines.push(`- ${truncateText(row.text, 500)}`);
    lines.push("");
  }
  if (nextCursor) lines.push(`_More available — pass after="${nextCursor}"._`);
  return lines.join("\n");
}

export function registerCommentTools(server: McpServer): void {
  server.registerTool(
    "instagram_list_comments",
    {
      title: "List Comments on Media",
      description: `List comments on one of the account's posts.

Args:
  - media_id (string): Numeric media ID
  - limit (number): Comments to return, 1-100 (default: 25)
  - after (string): Cursor from a previous response's 'next_cursor'
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "media_id": string,
    "count": number,
    "comments": [
      {
        "id": string,             // Pass to instagram_reply_to_comment
        "username": string,
        "text": string,
        "like_count": number,
        "hidden": boolean,
        "timestamp": string,      // ISO 8601
        "reply_count": number
      }
    ],
    "next_cursor": string,
    "has_more": boolean
  }

Examples:
  - "What are people saying on my latest post?" -> media_id from instagram_list_media
  - "Are there unanswered comments?" -> read reply_count on each entry
  - Don't use when: you need the comment count only — instagram_list_media already returns comments_count

Error Handling:
  - Requires the instagram_business_manage_comments permission
  - Only works on media owned by the authenticated account`,
      inputSchema: {
        media_id: instagramIdParam,
        limit: limitParam,
        after: afterParam,
        response_format: responseFormatParam,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const data = await graphGet<GraphListResponse<CommentObject>>(
          `${params.media_id}/comments`,
          {
            fields: `${COMMENT_FIELDS},replies{id}`,
            limit: params.limit,
            after: params.after,
          },
        );

        const comments = (data.data ?? []).map(toCommentRow);
        if (!comments.length) {
          return {
            content: [
              { type: "text" as const, text: `Post ${params.media_id} has no comments on this page.` },
            ],
          };
        }

        const nextCursor = data.paging?.cursors?.after;
        const payload = {
          media_id: params.media_id,
          count: comments.length,
          comments,
          ...(nextCursor && data.paging?.next ? { next_cursor: nextCursor } : {}),
          has_more: Boolean(data.paging?.next),
        };

        return respond(
          payload,
          (p) => renderComments(`Comments on ${p.media_id}`, p.comments, p.next_cursor),
          params.response_format,
          "comments",
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "instagram_reply_to_comment",
    {
      title: "Reply to a Comment",
      description: `Post a public reply to a comment. THIS IS VISIBLE TO EVERYONE IMMEDIATELY and this tool cannot delete it afterwards. Confirm the exact wording with the user before calling.

Args:
  - comment_id (string): Numeric comment ID, from instagram_list_comments
  - message (string): Reply text, 1-2200 characters
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "replied": true,
    "reply_id": string,           // ID of the newly created reply
    "parent_comment_id": string
  }

Examples:
  - "Thank this commenter" -> comment_id="17895...", message="Thanks for watching!"
  - Don't use when: the user has not approved the exact text

Error Handling:
  - Requires the instagram_business_manage_comments permission
  - Replying to a comment on media you do not own fails with an object-not-found error`,
      inputSchema: {
        comment_id: instagramIdParam,
        message: z
          .string()
          .min(1, "message must not be empty")
          .max(2200, "Instagram comments are capped at 2200 characters")
          .describe("The reply text to post publicly"),
        response_format: responseFormatParam,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const reply = await graphPost<{ id?: string }>(`${params.comment_id}/replies`, {
          message: params.message,
        });

        const payload = {
          replied: true,
          reply_id: reply.id ?? "",
          parent_comment_id: params.comment_id,
        };

        return respond(
          payload,
          (p) =>
            [
              "# Reply posted",
              "",
              `- **Reply ID**: ${p.reply_id}`,
              `- **In reply to**: ${p.parent_comment_id}`,
            ].join("\n"),
          params.response_format,
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );
}
