import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { describeError, ytRequest } from "../services/client.js";
import { errorResult, respond } from "../services/format.js";
import { renderVideoList, toVideoRow, type VideoRow } from "../services/render.js";
import {
  limitParam,
  pageTokenParam,
  responseFormatParam,
  videoIdParam,
} from "../schemas.js";
import type { ApiListResponse, VideoItem } from "../types.js";
import { ResponseFormat } from "../types.js";

/**
 * Fetch statistics and duration for videos that a `search.list` response only
 * described by snippet. Costs 1 quota unit regardless of how many ids are
 * passed, so it is worth doing eagerly rather than making the agent ask twice.
 */
async function enrichWithStatistics(rows: VideoRow[]): Promise<VideoRow[]> {
  const ids = rows.map((row) => row.id).filter(Boolean);
  if (!ids.length) return rows;

  const data = await ytRequest<ApiListResponse<VideoItem>>("videos", {
    part: "statistics,contentDetails",
    id: ids,
    maxResults: ids.length,
  });

  const byId = new Map<string, VideoItem>();
  for (const item of data.items ?? []) {
    if (typeof item.id === "string") byId.set(item.id, item);
  }

  return rows.map((row) => {
    const extra = byId.get(row.id);
    if (!extra) return row;
    return {
      ...row,
      duration: extra.contentDetails?.duration,
      view_count: extra.statistics?.viewCount,
      like_count: extra.statistics?.likeCount,
      comment_count: extra.statistics?.commentCount,
    };
  });
}

export function registerVideoTools(server: McpServer): void {
  server.registerTool(
    "youtube_search_videos",
    {
      title: "Search YouTube Videos",
      description: `Search YouTube for videos matching a query string.

Costs 100 quota units per call — by far the most expensive endpoint, out of a 10,000-unit daily allowance. Prefer youtube_list_channel_videos (1 unit) when you already know the channel, and youtube_get_video_details (1 unit) when you already have video IDs.

Args:
  - query (string): Search terms, 1-200 characters
  - limit (number): Results to return, 1-50 (default: 10)
  - page_token (string): Cursor from a previous response's 'next_page_token'
  - order ('relevance' | 'date' | 'viewCount' | 'rating' | 'title'): Sort order (default: 'relevance')
  - published_after (string): ISO 8601 timestamp; only videos published at or after this time
  - channel_id (string): Restrict the search to a single channel
  - include_statistics (boolean): Also fetch view/like/comment counts (default: true, costs 1 extra unit)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "query": string,
    "total_results": number,      // Approximate total matches reported by YouTube
    "count": number,              // Videos in this response
    "videos": [
      {
        "id": string,             // 11-character video ID
        "title": string,
        "channel_title": string,
        "channel_id": string,
        "published_at": string,   // ISO 8601
        "description": string,
        "duration": string,       // ISO 8601, only when include_statistics is true
        "view_count": string,     // only when include_statistics is true
        "like_count": string,
        "comment_count": string,
        "url": string
      }
    ],
    "next_page_token": string,    // Present only when more results exist
    "has_more": boolean
  }

Examples:
  - "Find recent videos about MCP servers" -> query="MCP server", order="date"
  - "Most viewed Claude Code tutorials" -> query="Claude Code tutorial", order="viewCount"
  - Don't use when: you already have video IDs — use youtube_get_video_details instead

Error Handling:
  - "The daily YouTube Data API quota is exhausted" when the 10,000-unit budget is spent
  - "No videos found matching '<query>'" when the search returns nothing`,
      inputSchema: {
        query: z
          .string()
          .min(1, "query must not be empty")
          .max(200, "query must not exceed 200 characters")
          .describe("Search terms to match against titles, descriptions, and tags"),
        limit: limitParam,
        page_token: pageTokenParam,
        order: z
          .enum(["relevance", "date", "viewCount", "rating", "title"])
          .default("relevance")
          .describe("Sort order for results"),
        published_after: z
          .string()
          .datetime({ message: "published_after must be an ISO 8601 timestamp, e.g. 2026-01-01T00:00:00Z" })
          .optional()
          .describe("Only return videos published at or after this ISO 8601 timestamp"),
        channel_id: z
          .string()
          .optional()
          .describe("Restrict results to this channel ID"),
        include_statistics: z
          .boolean()
          .default(true)
          .describe("Fetch view/like/comment counts for the results (1 extra quota unit)"),
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
        const data = await ytRequest<ApiListResponse<VideoItem>>("search", {
          part: "snippet",
          q: params.query,
          type: "video",
          maxResults: params.limit,
          order: params.order,
          pageToken: params.page_token,
          publishedAfter: params.published_after,
          channelId: params.channel_id,
        });

        const items = data.items ?? [];
        if (!items.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No videos found matching '${params.query}'. Try broader terms, or drop the published_after / channel_id filters.`,
              },
            ],
          };
        }

        let videos = items.map(toVideoRow);
        if (params.include_statistics) videos = await enrichWithStatistics(videos);

        const payload = {
          query: params.query,
          total_results: data.pageInfo?.totalResults ?? videos.length,
          count: videos.length,
          videos,
          ...(data.nextPageToken ? { next_page_token: data.nextPageToken } : {}),
          has_more: Boolean(data.nextPageToken),
        };

        return respond(
          payload,
          (p) =>
            renderVideoList(`Search: "${p.query}"`, p.videos, {
              total: p.total_results,
              nextPageToken: p.next_page_token,
            }),
          params.response_format,
          "videos",
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "youtube_get_video_details",
    {
      title: "Get YouTube Video Details",
      description: `Get full metadata and statistics for up to 50 videos in a single call.

Costs 1 quota unit no matter how many IDs are passed, so batch IDs together rather than calling once per video.

Args:
  - video_ids (string[]): 1-50 video IDs, each exactly 11 characters
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "count": number,
    "requested": number,          // How many IDs were asked for
    "missing": string[],          // IDs YouTube returned nothing for (deleted/private/wrong)
    "videos": [
      {
        "id": string,
        "title": string,
        "channel_title": string,
        "channel_id": string,
        "published_at": string,
        "description": string,
        "duration": string,       // ISO 8601, e.g. "PT12M34S"
        "view_count": string,
        "like_count": string,
        "comment_count": string,
        "url": string
      }
    ]
  }

Examples:
  - "How many views does this video have?" -> video_ids=["dQw4w9WgXcQ"]
  - "Compare these three videos" -> video_ids=["id1","id2","id3"]
  - Don't use when: you need to find videos by topic — use youtube_search_videos

Error Handling:
  - IDs that do not resolve are listed under "missing" rather than failing the call
  - Returns an error only when the API key or quota is the problem`,
      inputSchema: {
        video_ids: z
          .array(videoIdParam)
          .min(1, "Provide at least one video ID")
          .max(50, "The API accepts at most 50 IDs per call")
          .describe("Video IDs to look up, batched into one request"),
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
        const data = await ytRequest<ApiListResponse<VideoItem>>("videos", {
          part: "snippet,statistics,contentDetails",
          id: params.video_ids,
          maxResults: params.video_ids.length,
        });

        const videos = (data.items ?? []).map(toVideoRow);
        const found = new Set(videos.map((video) => video.id));
        const missing = params.video_ids.filter((id) => !found.has(id));

        if (!videos.length) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `None of the ${params.video_ids.length} requested IDs resolved to a video. ` +
                  `They may be deleted, private, or mistyped: ${params.video_ids.join(", ")}`,
              },
            ],
          };
        }

        const payload = {
          count: videos.length,
          requested: params.video_ids.length,
          missing,
          videos,
        };

        return respond(
          payload,
          (p) => {
            const body = renderVideoList("Video Details", p.videos);
            return p.missing.length
              ? `${body}\n\n_Not found: ${p.missing.join(", ")}_`
              : body;
          },
          params.response_format,
          "videos",
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "youtube_get_trending_videos",
    {
      title: "Get Trending YouTube Videos",
      description: `List the videos currently trending in a country, optionally narrowed to one category.

Costs 1 quota unit.

Args:
  - region_code (string): ISO 3166-1 alpha-2 country code, e.g. 'TR', 'US', 'GB' (default: 'US')
  - category_id (string): YouTube category ID, e.g. '10' music, '20' gaming, '28' science & tech
  - limit (number): Videos to return, 1-50 (default: 10)
  - page_token (string): Cursor from a previous response
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "region_code": string,
    "category_id": string,        // Present only when filtered
    "count": number,
    "videos": [ /* same video shape as youtube_get_video_details */ ],
    "next_page_token": string,
    "has_more": boolean
  }

Examples:
  - "What's trending in Turkey?" -> region_code="TR"
  - "Top trending music videos in the US" -> region_code="US", category_id="10"
  - Don't use when: you want a specific channel's popular videos — use youtube_list_channel_videos

Error Handling:
  - An unsupported region_code returns an API error naming the invalid parameter`,
      inputSchema: {
        region_code: z
          .string()
          .regex(/^[A-Za-z]{2}$/, "region_code must be a two-letter ISO 3166-1 country code")
          .default("US")
          .describe("ISO 3166-1 alpha-2 country code"),
        category_id: z
          .string()
          .regex(/^\d+$/, "category_id must be numeric")
          .optional()
          .describe("Numeric YouTube category ID to filter by"),
        limit: limitParam,
        page_token: pageTokenParam,
        response_format: responseFormatParam,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const data = await ytRequest<ApiListResponse<VideoItem>>("videos", {
          part: "snippet,statistics,contentDetails",
          chart: "mostPopular",
          regionCode: params.region_code.toUpperCase(),
          videoCategoryId: params.category_id,
          maxResults: params.limit,
          pageToken: params.page_token,
        });

        const videos = (data.items ?? []).map(toVideoRow);
        if (!videos.length) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `No trending videos for region '${params.region_code}'` +
                  (params.category_id ? ` in category ${params.category_id}` : "") +
                  ". The category may not be supported in this region.",
              },
            ],
          };
        }

        const payload = {
          region_code: params.region_code.toUpperCase(),
          ...(params.category_id ? { category_id: params.category_id } : {}),
          count: videos.length,
          videos,
          ...(data.nextPageToken ? { next_page_token: data.nextPageToken } : {}),
          has_more: Boolean(data.nextPageToken),
        };

        return respond(
          payload,
          (p) =>
            renderVideoList(`Trending in ${p.region_code}`, p.videos, {
              nextPageToken: p.next_page_token,
            }),
          params.response_format,
          "videos",
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );
}

export { ResponseFormat };
