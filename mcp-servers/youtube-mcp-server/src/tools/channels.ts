import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { YouTubeApiError, describeError, ytRequest } from "../services/client.js";
import { channelUrl, errorResult, formatCount, formatDate, respond, truncateText } from "../services/format.js";
import { renderVideoList, toVideoRow } from "../services/render.js";
import { limitParam, pageTokenParam, responseFormatParam } from "../schemas.js";
import type { ApiListResponse, ChannelItem, VideoItem } from "../types.js";

/**
 * Resolve whatever the caller supplied — a UC... ID, an @handle, or a legacy
 * custom name — into a channel record. Agents rarely have the raw ID on hand,
 * so accepting handles avoids forcing a 100-unit search just to find one.
 */
async function resolveChannel(identifier: string): Promise<ChannelItem> {
  const trimmed = identifier.trim();
  const params: Record<string, string> = {
    part: "snippet,statistics,contentDetails",
  };

  if (/^UC[A-Za-z0-9_-]{22}$/.test(trimmed)) {
    params["id"] = trimmed;
  } else if (trimmed.startsWith("@")) {
    params["forHandle"] = trimmed;
  } else {
    params["forHandle"] = `@${trimmed}`;
  }

  const data = await ytRequest<ApiListResponse<ChannelItem>>("channels", params);
  const channel = data.items?.[0];
  if (!channel) {
    throw new YouTubeApiError(
      404,
      "channelNotFound",
      `No channel matched '${identifier}'. Pass the 'UC...' channel ID or the @handle exactly as it appears on the channel page.`,
    );
  }
  return channel;
}

export function registerChannelTools(server: McpServer): void {
  server.registerTool(
    "youtube_get_channel",
    {
      title: "Get YouTube Channel",
      description: `Look up a channel's profile and statistics by channel ID or @handle.

Costs 1 quota unit. Accepts either form of identifier, so there is no need to search for the ID first.

Args:
  - channel (string): Channel ID ('UC...') or handle ('@AnthropicAI' / 'AnthropicAI')
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "id": string,                 // Channel ID
    "title": string,
    "handle": string,             // Custom URL / handle, when the channel has one
    "description": string,
    "country": string,
    "published_at": string,       // Channel creation date, ISO 8601
    "subscriber_count": string,   // Absent when the channel hides it
    "video_count": string,
    "view_count": string,
    "uploads_playlist_id": string, // Feed this to youtube_list_channel_videos
    "url": string
  }

Examples:
  - "How many subscribers does @AnthropicAI have?" -> channel="@AnthropicAI"
  - "Show me this channel's stats" -> channel="UCrDwWp7EBBv4NwvScIpBDOA"
  - Don't use when: you want the channel's videos — use youtube_list_channel_videos

Error Handling:
  - "No channel matched '<id>'" when neither the ID nor handle resolves
  - subscriber_count is omitted when the channel has hidden its subscriber count`,
      inputSchema: {
        channel: z
          .string()
          .min(1, "channel must not be empty")
          .describe("Channel ID starting with 'UC', or an @handle"),
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
        const channel = await resolveChannel(params.channel);
        const snippet = channel.snippet ?? {};
        const statistics = channel.statistics ?? {};
        const hidden = statistics.hiddenSubscriberCount === true;

        const payload = {
          id: channel.id ?? "",
          title: snippet.title ?? "(untitled)",
          ...(snippet.customUrl ? { handle: snippet.customUrl } : {}),
          description: snippet.description ?? "",
          ...(snippet.country ? { country: snippet.country } : {}),
          published_at: snippet.publishedAt ?? "",
          ...(hidden ? {} : { subscriber_count: statistics.subscriberCount ?? "0" }),
          video_count: statistics.videoCount ?? "0",
          view_count: statistics.viewCount ?? "0",
          uploads_playlist_id: channel.contentDetails?.relatedPlaylists?.uploads ?? "",
          url: channelUrl(channel.id ?? ""),
        };

        return respond(
          payload,
          (p) => {
            const lines = [`# ${p.title}`, ""];
            if (p.handle) lines.push(`- **Handle**: ${p.handle}`);
            lines.push(`- **Channel ID**: ${p.id}`);
            lines.push(
              `- **Subscribers**: ${
                "subscriber_count" in p ? formatCount(p.subscriber_count) : "hidden by the channel"
              }`,
            );
            lines.push(`- **Videos**: ${formatCount(p.video_count)}`);
            lines.push(`- **Total views**: ${formatCount(p.view_count)}`);
            if (p.country) lines.push(`- **Country**: ${p.country}`);
            lines.push(`- **Created**: ${formatDate(p.published_at)}`);
            lines.push(`- ${p.url}`, "");
            if (p.description) lines.push(truncateText(p.description, 500));
            return lines.join("\n");
          },
          params.response_format,
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "youtube_list_channel_videos",
    {
      title: "List Channel Videos",
      description: `List a channel's uploads in reverse-chronological order.

Costs 2 quota units on the first page (one to resolve the channel, one to read its uploads playlist) and 1 unit per subsequent page — versus 100 units for the equivalent search. Always prefer this over youtube_search_videos when the channel is known.

Args:
  - channel (string): Channel ID ('UC...') or handle ('@AnthropicAI')
  - limit (number): Videos to return, 1-50 (default: 10)
  - page_token (string): Cursor from a previous response's 'next_page_token'
  - include_statistics (boolean): Also fetch view/like/comment counts (default: true, 1 extra unit)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "channel_id": string,
    "channel_title": string,
    "count": number,
    "videos": [ /* same video shape as youtube_get_video_details */ ],
    "next_page_token": string,
    "has_more": boolean
  }

Examples:
  - "What has @AnthropicAI posted recently?" -> channel="@AnthropicAI"
  - "Next 20 videos from this channel" -> channel="UC...", limit=20, page_token="..."
  - Don't use when: you want the most-viewed videos rather than the newest — use youtube_search_videos with order="viewCount" and channel_id

Error Handling:
  - "No channel matched '<id>'" when the identifier does not resolve
  - An empty uploads playlist returns a message rather than an error`,
      inputSchema: {
        channel: z
          .string()
          .min(1, "channel must not be empty")
          .describe("Channel ID starting with 'UC', or an @handle"),
        limit: limitParam,
        page_token: pageTokenParam,
        include_statistics: z
          .boolean()
          .default(true)
          .describe("Fetch view/like/comment counts for the listed videos (1 extra quota unit)"),
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
        const channel = await resolveChannel(params.channel);
        const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
        if (!uploads) {
          return errorResult(
            `Channel '${channel.snippet?.title ?? params.channel}' exposes no uploads playlist, so its videos cannot be listed.`,
          );
        }

        const playlist = await ytRequest<ApiListResponse<VideoItem>>("playlistItems", {
          part: "snippet,contentDetails",
          playlistId: uploads,
          maxResults: params.limit,
          pageToken: params.page_token,
        });

        const entries = playlist.items ?? [];
        if (!entries.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Channel '${channel.snippet?.title ?? params.channel}' has no videos on this page.`,
              },
            ],
          };
        }

        // playlistItems nests the real video ID under contentDetails; the item's
        // own id refers to the playlist entry, not the video. toVideoRow knows this.
        let videos = entries.map(toVideoRow);
        const videoIds = videos.map((video) => video.id).filter(Boolean);

        if (params.include_statistics && videoIds.length) {
          const details = await ytRequest<ApiListResponse<VideoItem>>("videos", {
            part: "statistics,contentDetails",
            id: videoIds,
            maxResults: videoIds.length,
          });
          const byId = new Map<string, VideoItem>();
          for (const item of details.items ?? []) {
            if (typeof item.id === "string") byId.set(item.id, item);
          }
          videos = videos.map((video) => {
            const extra = byId.get(video.id);
            if (!extra) return video;
            return {
              ...video,
              duration: extra.contentDetails?.duration,
              view_count: extra.statistics?.viewCount,
              like_count: extra.statistics?.likeCount,
              comment_count: extra.statistics?.commentCount,
            };
          });
        }

        const payload = {
          channel_id: channel.id ?? "",
          channel_title: channel.snippet?.title ?? "",
          count: videos.length,
          videos,
          ...(playlist.nextPageToken ? { next_page_token: playlist.nextPageToken } : {}),
          has_more: Boolean(playlist.nextPageToken),
        };

        return respond(
          payload,
          (p) =>
            renderVideoList(`${p.channel_title} — uploads`, p.videos, {
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
    "youtube_list_playlist_items",
    {
      title: "List Playlist Items",
      description: `List the videos in a public playlist, in playlist order.

Costs 1 quota unit per page.

Args:
  - playlist_id (string): Playlist ID, usually starting with 'PL'
  - limit (number): Items to return, 1-50 (default: 10)
  - page_token (string): Cursor from a previous response's 'next_page_token'
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "playlist_id": string,
    "count": number,
    "videos": [
      {
        "id": string,             // Video ID
        "title": string,
        "channel_title": string,  // The video's own channel, not the playlist owner
        "published_at": string,   // When the video was added to the playlist
        "description": string,
        "url": string
      }
    ],
    "next_page_token": string,
    "has_more": boolean
  }

Examples:
  - "What's in this playlist?" -> playlist_id="PLf2m23nhTg1P5BsOHUOXyQz5RhfUSSVUi"
  - "Next page of the playlist" -> playlist_id="PL...", page_token="..."
  - Don't use when: you want a channel's uploads — use youtube_list_channel_videos

Error Handling:
  - "No playlist with that ID" when the playlist is private or mistyped
  - Private or deleted videos inside a public playlist appear with the title "Private video"`,
      inputSchema: {
        playlist_id: z
          .string()
          .min(2, "playlist_id must not be empty")
          .describe("Playlist ID, usually starting with 'PL'"),
        limit: limitParam,
        page_token: pageTokenParam,
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
        const data = await ytRequest<ApiListResponse<VideoItem>>("playlistItems", {
          part: "snippet,contentDetails",
          playlistId: params.playlist_id,
          maxResults: params.limit,
          pageToken: params.page_token,
        });

        const entries = data.items ?? [];
        if (!entries.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Playlist '${params.playlist_id}' returned no items on this page.`,
              },
            ],
          };
        }

        const videos = entries.map(toVideoRow);

        const payload = {
          playlist_id: params.playlist_id,
          count: videos.length,
          videos,
          ...(data.nextPageToken ? { next_page_token: data.nextPageToken } : {}),
          has_more: Boolean(data.nextPageToken),
        };

        return respond(
          payload,
          (p) =>
            renderVideoList(`Playlist ${p.playlist_id}`, p.videos, {
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
