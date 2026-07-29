import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { describeError, ytRequest } from "../services/client.js";
import {
  errorResult,
  formatCount,
  formatDate,
  respond,
  stripHtml,
  truncateText,
} from "../services/format.js";
import { limitParam, pageTokenParam, responseFormatParam, videoIdParam } from "../schemas.js";
import type { ApiListResponse, CaptionItem, CommentThreadItem } from "../types.js";


export function registerEngagementTools(server: McpServer): void {
  server.registerTool(
    "youtube_list_video_comments",
    {
      title: "List Video Comments",
      description: `List top-level comments on a video, newest or most-liked first.

Costs 1 quota unit per page.

Args:
  - video_id (string): 11-character video ID
  - limit (number): Comments to return, 1-50 (default: 20)
  - page_token (string): Cursor from a previous response's 'next_page_token'
  - order ('time' | 'relevance'): 'relevance' surfaces most-engaged comments, 'time' is newest-first (default: 'relevance')
  - search_terms (string): Only return comments containing these terms
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "video_id": string,
    "count": number,
    "comments": [
      {
        "id": string,
        "author": string,          // Display name
        "text": string,            // Plain text, HTML stripped
        "like_count": number,
        "reply_count": number,
        "published_at": string,    // ISO 8601
        "updated_at": string
      }
    ],
    "next_page_token": string,
    "has_more": boolean
  }

Examples:
  - "What are people saying about this video?" -> video_id="dQw4w9WgXcQ"
  - "Any comments mentioning bugs?" -> video_id="...", search_terms="bug"
  - Don't use when: you only need the comment count — youtube_get_video_details already returns it for 1 unit

Error Handling:
  - "Comments are disabled on this video" when the owner has turned them off
  - Replies are not expanded; reply_count tells you how many exist`,
      inputSchema: {
        video_id: videoIdParam,
        limit: limitParam.default(20),
        page_token: pageTokenParam,
        order: z
          .enum(["time", "relevance"])
          .default("relevance")
          .describe("Sort order: 'relevance' for most-engaged, 'time' for newest-first"),
        search_terms: z
          .string()
          .optional()
          .describe("Only return comments containing these terms"),
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
        const data = await ytRequest<ApiListResponse<CommentThreadItem>>("commentThreads", {
          part: "snippet",
          videoId: params.video_id,
          maxResults: params.limit,
          order: params.order,
          pageToken: params.page_token,
          searchTerms: params.search_terms,
          textFormat: "plainText",
        });

        const threads = data.items ?? [];
        if (!threads.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: params.search_terms
                  ? `No comments on ${params.video_id} matched '${params.search_terms}'.`
                  : `Video ${params.video_id} has no comments on this page.`,
              },
            ],
          };
        }

        const comments = threads.map((thread) => {
          const top = thread.snippet?.topLevelComment?.snippet ?? {};
          return {
            id: thread.snippet?.topLevelComment?.id ?? thread.id ?? "",
            author: top.authorDisplayName ?? "(unknown)",
            text: stripHtml(top.textOriginal ?? top.textDisplay),
            like_count: top.likeCount ?? 0,
            reply_count: thread.snippet?.totalReplyCount ?? 0,
            published_at: top.publishedAt ?? "",
            updated_at: top.updatedAt ?? "",
          };
        });

        const payload = {
          video_id: params.video_id,
          count: comments.length,
          comments,
          ...(data.nextPageToken ? { next_page_token: data.nextPageToken } : {}),
          has_more: Boolean(data.nextPageToken),
        };

        return respond(
          payload,
          (p) => {
            const lines = [`# Comments on ${p.video_id}`, "", `Showing ${p.count}`, ""];
            for (const comment of p.comments) {
              lines.push(`## ${comment.author}`);
              lines.push(
                `- ${formatCount(comment.like_count)} likes · ${comment.reply_count} replies · ${formatDate(comment.published_at)}`,
              );
              lines.push(`- ${truncateText(comment.text, 500)}`);
              lines.push("");
            }
            if (p.next_page_token) {
              lines.push(`_More comments available — pass page_token="${p.next_page_token}"._`);
            }
            return lines.join("\n");
          },
          params.response_format,
          "comments",
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "youtube_list_caption_tracks",
    {
      title: "List Caption Tracks",
      description: `List the caption tracks published on a video — which languages exist, and whether each is auto-generated or human-authored.

Costs 50 quota units. Returns track METADATA ONLY. There is no tool here that returns caption text, and that is a hard limit rather than a gap: this server cannot retrieve transcripts for videos it does not own. Do not attempt to work around it.

  - captions.download rejects API keys outright ("API keys are not supported by this API. Expected OAuth2 access token ... that assert a principal") and, even with OAuth, serves text only to the video's owner.
  - The caption URLs embedded in the public watch page now return HTTP 200 with an empty body unless the request carries a proof-of-origin token bound to a real player session.

Both were verified against this API. To actually read a transcript: use a browser session for someone else's video, add OAuth for your own uploads, or use a dedicated transcript service.

Args:
  - video_id (string): 11-character video ID
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "video_id": string,
    "count": number,
    "text_retrievable": false,   // Always false — see above
    "tracks": [
      {
        "id": string,
        "language": string,        // BCP-47 code, e.g. "en", "tr"
        "name": string,            // Track label, often empty for auto-generated tracks
        "kind": string,            // "asr" = auto-generated speech recognition, "standard" = uploaded
        "is_auto_generated": boolean,
        "is_closed_caption": boolean,
        "status": string,          // "serving" when publicly available
        "last_updated": string     // ISO 8601
      }
    ]
  }

Examples:
  - "Does this video have Turkish subtitles?" -> video_id="..."
  - "Are the captions auto-generated?" -> video_id="..." then read kind/is_auto_generated
  - "Summarize this video" -> this tool cannot help; say the transcript is not retrievable rather than inferring content from the title and description

Error Handling:
  - Returns an empty track list rather than an error when the video has no captions`,
      inputSchema: {
        video_id: videoIdParam,
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
        const data = await ytRequest<ApiListResponse<CaptionItem>>("captions", {
          part: "snippet",
          videoId: params.video_id,
        });

        const tracks = (data.items ?? []).map((item) => ({
          id: item.id ?? "",
          language: item.snippet?.language ?? "unknown",
          name: item.snippet?.name ?? "",
          kind: item.snippet?.trackKind ?? "unknown",
          is_auto_generated: item.snippet?.trackKind === "asr",
          is_closed_caption: item.snippet?.isCC === true,
          status: item.snippet?.status ?? "unknown",
          last_updated: item.snippet?.lastUpdated ?? "",
        }));

        // Stated in the payload as well as the description: an agent that reads
        // "a track exists" should not conclude the words are within reach.
        const payload = {
          video_id: params.video_id,
          count: tracks.length,
          text_retrievable: false,
          tracks,
        };

        return respond(
          payload,
          (p) => {
            if (!p.count) return `Video ${p.video_id} has no caption tracks.`;
            const lines = [`# Caption tracks for ${p.video_id}`, ""];
            for (const track of p.tracks) {
              const label = track.name || "(unnamed)";
              lines.push(
                `- **${track.language}** ${label} — ${
                  track.is_auto_generated ? "auto-generated" : "uploaded"
                }${track.is_closed_caption ? ", closed captions" : ""} · ${track.status}`,
              );
            }
            lines.push(
              "",
              "_Track metadata only — the caption text is not retrievable through this server " +
                "for videos it does not own. Do not infer the video's content from its title " +
                "or description; say the transcript is unavailable instead._",
            );
            return lines.join("\n");
          },
          params.response_format,
          "tracks",
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

}
