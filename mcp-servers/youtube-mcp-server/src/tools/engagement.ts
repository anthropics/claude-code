import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { REQUEST_TIMEOUT_MS } from "../constants.js";
import { describeError, ytRequest } from "../services/client.js";
import {
  errorResult,
  formatCount,
  formatDate,
  respond,
  stripHtml,
  truncateText,
  videoUrl,
} from "../services/format.js";
import { limitParam, pageTokenParam, responseFormatParam, videoIdParam } from "../schemas.js";
import type { ApiListResponse, CaptionItem, CommentThreadItem, TranscriptCue } from "../types.js";

/** Render seconds as m:ss / h:mm:ss for transcript cue timestamps. */
function stamp(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Fetch a caption track by scraping the watch page for its `baseUrl`.
 *
 * The Data API cannot do this: `captions.download` requires an OAuth token from
 * the video's owner, so an API key alone can only *list* tracks. Every
 * transcript tool in the ecosystem therefore relies on this unofficial
 * endpoint, and it can break whenever YouTube changes its player payload.
 */
async function fetchTranscript(
  videoId: string,
  language: string | undefined,
): Promise<{ cues: TranscriptCue[]; language: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const page = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: controller.signal,
      headers: {
        // Without a browser-like UA and language header YouTube serves a
        // consent interstitial that carries no caption payload.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        "Accept-Language": language ?? "en",
      },
    });

    if (!page.ok) {
      throw new Error(`watch page returned HTTP ${page.status}`);
    }

    const html = await page.text();
    const match = /"captionTracks":(\[.*?\])/.exec(html);
    if (!match?.[1]) {
      throw new Error(
        "no caption tracks in the player payload — the video may have captions disabled, " +
          "or YouTube served a consent/bot-check page instead",
      );
    }

    const tracks = JSON.parse(match[1]) as Array<{
      baseUrl?: string;
      languageCode?: string;
      kind?: string;
    }>;
    if (!tracks.length) throw new Error("the video has no caption tracks");

    const chosen =
      (language ? tracks.find((track) => track.languageCode === language) : undefined) ??
      tracks[0];
    if (!chosen?.baseUrl) {
      throw new Error(
        language
          ? `no '${language}' caption track (available: ${tracks
              .map((t) => t.languageCode)
              .join(", ")})`
          : "caption track carried no download URL",
      );
    }

    const xml = await (
      await fetch(`${chosen.baseUrl}&fmt=json3`, { signal: controller.signal })
    ).text();

    const parsed = JSON.parse(xml) as {
      events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }>;
    };

    const cues: TranscriptCue[] = [];
    for (const event of parsed.events ?? []) {
      const text = (event.segs ?? []).map((seg) => seg.utf8 ?? "").join("").trim();
      if (!text) continue;
      cues.push({
        start: (event.tStartMs ?? 0) / 1000,
        duration: (event.dDurationMs ?? 0) / 1000,
        text,
      });
    }

    return { cues, language: chosen.languageCode ?? language ?? "unknown" };
  } finally {
    clearTimeout(timer);
  }
}

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

Costs 50 quota units. This returns track *metadata* only. The Data API cannot return caption text without an OAuth token from the video's owner, so use youtube_get_transcript to read the actual words.

Args:
  - video_id (string): 11-character video ID
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "video_id": string,
    "count": number,
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
  - Don't use when: you want the transcript text — use youtube_get_transcript

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

        const payload = { video_id: params.video_id, count: tracks.length, tracks };

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

  server.registerTool(
    "youtube_get_transcript",
    {
      title: "Get Video Transcript",
      description: `Fetch the spoken text of a video as timestamped cues.

Costs no API quota — but it does NOT use the Data API. YouTube's captions.download endpoint requires an OAuth token from the video's owner, so this tool reads the caption track from the public watch page instead. That endpoint is undocumented and can break without notice; treat a failure here as an upstream change rather than a configuration problem.

Args:
  - video_id (string): 11-character video ID
  - language (string): Preferred BCP-47 language code, e.g. 'en', 'tr'. Falls back to the video's first available track.
  - include_timestamps (boolean): Prefix each line with its timecode (default: true)
  - max_cues (number): Cap the number of cues returned, 1-2000 (default: 500)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "video_id": string,
    "language": string,           // Language actually returned, which may differ from the request
    "cue_count": number,
    "duration_seconds": number,   // End of the last cue
    "truncated": boolean,         // True when max_cues clipped the transcript
    "cues": [
      { "start": number, "duration": number, "text": string }   // seconds
    ],
    "url": string
  }

Examples:
  - "Summarize this video" -> video_id="...", then summarize the returned text
  - "What did they say about pricing?" -> video_id="...", then search the cues
  - Don't use when: you only need to know which languages exist — use youtube_list_caption_tracks (cheaper to reason about, official API)

Error Handling:
  - "no caption tracks in the player payload" when captions are disabled, or when YouTube served a bot-check page
  - "no '<lang>' caption track" lists the languages that do exist`,
      inputSchema: {
        video_id: videoIdParam,
        language: z
          .string()
          .min(2, "language must be a BCP-47 code such as 'en' or 'tr'")
          .max(10)
          .optional()
          .describe("Preferred caption language code; falls back to the first available track"),
        include_timestamps: z
          .boolean()
          .default(true)
          .describe("Prefix each markdown line with its timecode"),
        max_cues: z
          .number()
          .int()
          .min(1)
          .max(2000)
          .default(500)
          .describe("Maximum cues to return before truncating"),
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
        const { cues, language } = await fetchTranscript(params.video_id, params.language);
        if (!cues.length) {
          return errorResult(
            `No transcript cues for ${params.video_id}. Call youtube_list_caption_tracks to check whether the video publishes captions at all.`,
          );
        }

        const clipped = cues.slice(0, params.max_cues);
        const last = clipped[clipped.length - 1];

        const payload = {
          video_id: params.video_id,
          language,
          cue_count: clipped.length,
          duration_seconds: last ? Math.round(last.start + last.duration) : 0,
          truncated: cues.length > clipped.length,
          cues: clipped,
          url: videoUrl(params.video_id),
        };

        return respond(
          payload,
          (p) => {
            const lines = [
              `# Transcript — ${p.video_id} (${p.language})`,
              "",
              `${p.cue_count} cues · ${stamp(p.duration_seconds)}`,
              "",
            ];
            for (const cue of p.cues) {
              lines.push(params.include_timestamps ? `[${stamp(cue.start)}] ${cue.text}` : cue.text);
            }
            if (p.truncated) {
              lines.push("", `_Truncated at ${p.cue_count} cues — raise max_cues for more._`);
            }
            return lines.join("\n");
          },
          params.response_format,
          "cues",
        );
      } catch (error) {
        return errorResult(
          `Error: Could not fetch the transcript for ${params.video_id}: ${
            error instanceof Error ? error.message : String(error)
          }. This tool depends on YouTube's undocumented caption endpoint, which is not part of the Data API — see the server README.`,
        );
      }
    },
  );
}
