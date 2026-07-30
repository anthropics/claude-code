import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CONTAINER_POLL_ATTEMPTS, CONTAINER_POLL_INTERVAL_MS } from "../constants.js";
import { GraphApiError, describeError, graphGet, graphPost, requireAccountId } from "../services/client.js";
import { errorResult, formatCount, formatTimestamp, respond, truncateText } from "../services/format.js";
import { afterParam, instagramIdParam, limitParam, responseFormatParam } from "../schemas.js";
import type { ContainerStatus, GraphListResponse, MediaObject } from "../types.js";

const MEDIA_FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_product_type",
  "media_url",
  "permalink",
  "thumbnail_url",
  "timestamp",
  "username",
  "like_count",
  "comments_count",
  "is_comment_enabled",
].join(",");

interface MediaRow {
  id: string;
  caption: string;
  media_type: string;
  media_product_type?: string;
  permalink: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp: string;
  like_count: number;
  comments_count: number;
  is_comment_enabled?: boolean;
}

function toMediaRow(media: MediaObject): MediaRow {
  return {
    id: media.id ?? "",
    caption: media.caption ?? "",
    media_type: media.media_type ?? "unknown",
    media_product_type: media.media_product_type,
    permalink: media.permalink ?? "",
    media_url: media.media_url,
    thumbnail_url: media.thumbnail_url,
    timestamp: media.timestamp ?? "",
    like_count: media.like_count ?? 0,
    comments_count: media.comments_count ?? 0,
    is_comment_enabled: media.is_comment_enabled,
  };
}

function renderMediaRows(heading: string, rows: MediaRow[], nextCursor?: string): string {
  const lines = [`# ${heading}`, "", `Showing ${rows.length}`, ""];
  for (const row of rows) {
    lines.push(`## ${row.media_type} · ${formatTimestamp(row.timestamp)}`);
    lines.push(`- **ID**: ${row.id}`);
    lines.push(
      `- ${formatCount(row.like_count)} likes · ${formatCount(row.comments_count)} comments`,
    );
    if (row.caption) lines.push(`- ${truncateText(row.caption, 200)}`);
    if (row.permalink) lines.push(`- ${row.permalink}`);
    lines.push("");
  }
  if (nextCursor) lines.push(`_More available — pass after="${nextCursor}"._`);
  return lines.join("\n");
}

/**
 * Wait for a publishing container to finish processing.
 *
 * Images are usually FINISHED immediately, but video and reel containers are
 * transcoded asynchronously and publishing one before it is ready fails. This
 * polls until the container reports a terminal state.
 */
async function awaitContainer(containerId: string): Promise<void> {
  for (let attempt = 0; attempt < CONTAINER_POLL_ATTEMPTS; attempt += 1) {
    const container = await graphGet<{ status_code?: ContainerStatus; status?: string }>(
      containerId,
      { fields: "status_code,status" },
    );
    const status = container.status_code;

    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new GraphApiError(
        400,
        0,
        undefined,
        `Media container ${containerId} ended in state ${status}. ${
          container.status ?? "Check that the media URL is publicly reachable and that the file meets Instagram's format requirements (JPEG only for images)."
        }`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, CONTAINER_POLL_INTERVAL_MS));
  }

  throw new GraphApiError(
    408,
    0,
    undefined,
    `Media container ${containerId} was still processing after ${
      (CONTAINER_POLL_ATTEMPTS * CONTAINER_POLL_INTERVAL_MS) / 1000
    }s. Large videos can take longer — the container stays valid for 24 hours, so retry publishing it later.`,
  );
}

export function registerMediaTools(server: McpServer): void {
  server.registerTool(
    "instagram_list_media",
    {
      title: "List Account Media",
      description: `List the account's published posts, newest first.

Args:
  - account_id (string): Numeric account ID (defaults to INSTAGRAM_ACCOUNT_ID)
  - limit (number): Posts to return, 1-100 (default: 25)
  - after (string): Cursor from a previous response's 'next_cursor'
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "account_id": string,
    "count": number,
    "media": [
      {
        "id": string,
        "caption": string,
        "media_type": string,       // IMAGE | VIDEO | CAROUSEL_ALBUM
        "media_product_type": string, // FEED | REELS | STORY
        "permalink": string,
        "media_url": string,
        "thumbnail_url": string,    // Videos only
        "timestamp": string,        // ISO 8601
        "like_count": number,
        "comments_count": number,
        "is_comment_enabled": boolean
      }
    ],
    "next_cursor": string,
    "has_more": boolean
  }

Examples:
  - "What did I post recently?" -> defaults to the configured account
  - "Next page of posts" -> after="<cursor from previous call>"
  - Don't use when: you need metrics per post — use instagram_get_media_insights

Error Handling:
  - Stories expire after 24 hours and do not appear here`,
      inputSchema: {
        account_id: z.string().optional().describe("Numeric account ID; defaults to INSTAGRAM_ACCOUNT_ID"),
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
        const accountId = params.account_id ?? requireAccountId();
        const data = await graphGet<GraphListResponse<MediaObject>>(`${accountId}/media`, {
          fields: MEDIA_FIELDS,
          limit: params.limit,
          after: params.after,
        });

        const media = (data.data ?? []).map(toMediaRow);
        if (!media.length) {
          return {
            content: [
              { type: "text" as const, text: `Account ${accountId} has no posts on this page.` },
            ],
          };
        }

        const nextCursor = data.paging?.cursors?.after;
        const payload = {
          account_id: accountId,
          count: media.length,
          media,
          ...(nextCursor && data.paging?.next ? { next_cursor: nextCursor } : {}),
          has_more: Boolean(data.paging?.next),
        };

        return respond(
          payload,
          (p) => renderMediaRows("Recent posts", p.media, p.next_cursor),
          params.response_format,
          "media",
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "instagram_get_media",
    {
      title: "Get Media Object",
      description: `Get one post's full details, including carousel children.

Args:
  - media_id (string): Numeric media ID
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "id": string,
    "caption": string,
    "media_type": string,
    "media_product_type": string,
    "permalink": string,
    "media_url": string,
    "thumbnail_url": string,
    "timestamp": string,
    "like_count": number,
    "comments_count": number,
    "is_comment_enabled": boolean,
    "children": [ { "id": string, "media_type": string, "media_url": string } ]
  }

Examples:
  - "Show me this post" -> media_id="17895695668004550"
  - "What's in this carousel?" -> media_id="...", then read children
  - Don't use when: listing many posts — use instagram_list_media

Error Handling:
  - "No object with that ID is visible to this token" when the post belongs to another account`,
      inputSchema: {
        media_id: instagramIdParam,
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
        const media = await graphGet<MediaObject>(params.media_id, {
          fields: `${MEDIA_FIELDS},children{id,media_type,media_url}`,
        });

        const payload = {
          ...toMediaRow(media),
          children: (media.children?.data ?? []).map((child) => ({
            id: child.id ?? "",
            media_type: child.media_type ?? "unknown",
            media_url: child.media_url ?? "",
          })),
        };

        return respond(
          payload,
          (p) => {
            const lines = renderMediaRows("Post", [p]).split("\n");
            if (p.children.length) {
              lines.push("", `**Carousel items**: ${p.children.length}`);
              for (const child of p.children) lines.push(`- ${child.media_type} · ${child.id}`);
            }
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
    "instagram_publish_post",
    {
      title: "Publish Instagram Post",
      description: `Publish an image or video to the account's feed. THIS POSTS PUBLICLY AND IMMEDIATELY — the post appears on the live account as soon as the call succeeds, and this tool cannot delete it afterwards. Confirm the caption and media with the user before calling.

Publishing is a two-step flow: a container is created from the media URL, then published once processing finishes. Video containers are transcoded asynchronously, so this tool polls until the container is ready before publishing.

Requirements Instagram enforces:
  - The media must already be hosted on a publicly reachable HTTPS URL — Instagram fetches it server-side, so local files and signed URLs that expire will fail
  - Images must be JPEG. PNG, WebP, MPO, and JPS are rejected
  - Counts against the 100-posts-per-24-hours limit; check instagram_get_publishing_limit first

Args:
  - image_url (string): Public HTTPS URL of a JPEG. Provide exactly one of image_url or video_url
  - video_url (string): Public HTTPS URL of a video
  - caption (string): Post caption, up to 2200 characters
  - media_type ('REELS' | 'STORIES'): Set for video posts; omit for a normal feed image
  - alt_text (string): Accessibility text for image posts (not supported for reels or stories)
  - account_id (string): Numeric account ID (defaults to INSTAGRAM_ACCOUNT_ID)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "published": true,
    "media_id": string,           // ID of the live post
    "container_id": string,
    "permalink": string           // Public URL, when the API returns it
  }

Examples:
  - "Post this photo with caption X" -> image_url="https://...jpg", caption="X"
  - "Publish this as a reel" -> video_url="https://...mp4", media_type="REELS"
  - Don't use when: the user has not confirmed the exact caption and image

Error Handling:
  - "The publishing limit is exhausted" when 100 posts have been published in 24 hours
  - Container ERROR usually means the media URL is unreachable or the format is unsupported
  - A container that is still processing after 60s is reported as a timeout; the container stays valid for 24 hours`,
      inputSchema: {
        image_url: z
          .string()
          .url("image_url must be an absolute URL")
          .optional()
          .describe("Public HTTPS URL of a JPEG image"),
        video_url: z
          .string()
          .url("video_url must be an absolute URL")
          .optional()
          .describe("Public HTTPS URL of a video file"),
        caption: z
          .string()
          .max(2200, "Instagram captions are capped at 2200 characters")
          .optional()
          .describe("Caption text for the post"),
        media_type: z
          .enum(["REELS", "STORIES"])
          .optional()
          .describe("Set for video posts; omit for a standard feed image"),
        alt_text: z
          .string()
          .max(1000)
          .optional()
          .describe("Accessibility alt text; image posts only"),
        account_id: z.string().optional().describe("Numeric account ID; defaults to INSTAGRAM_ACCOUNT_ID"),
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
        if (!params.image_url && !params.video_url) {
          return errorResult(
            "Error: Provide either image_url or video_url — there is nothing to publish otherwise.",
          );
        }
        if (params.image_url && params.video_url) {
          return errorResult(
            "Error: Provide exactly one of image_url or video_url. To publish several images as one " +
              "swipeable post, use instagram_publish_carousel.",
          );
        }

        const accountId = params.account_id ?? requireAccountId();

        const container = await graphPost<{ id?: string }>(`${accountId}/media`, {
          image_url: params.image_url,
          video_url: params.video_url,
          caption: params.caption,
          media_type: params.media_type,
          alt_text: params.alt_text,
        });

        const containerId = container.id;
        if (!containerId) {
          return errorResult("Error: The Graph API accepted the container request but returned no container ID.");
        }

        await awaitContainer(containerId);

        const published = await graphPost<{ id?: string }>(`${accountId}/media_publish`, {
          creation_id: containerId,
        });

        const mediaId = published.id ?? "";
        let permalink = "";
        if (mediaId) {
          try {
            const media = await graphGet<MediaObject>(mediaId, { fields: "permalink" });
            permalink = media.permalink ?? "";
          } catch {
            // The post is already live; a missing permalink is not worth failing over.
          }
        }

        const payload = {
          published: true,
          media_id: mediaId,
          container_id: containerId,
          ...(permalink ? { permalink } : {}),
        };

        return respond(
          payload,
          (p) =>
            [
              "# Published",
              "",
              `- **Media ID**: ${p.media_id}`,
              `- **Container ID**: ${p.container_id}`,
              ...(p.permalink ? [`- ${p.permalink}`] : []),
            ].join("\n"),
          params.response_format,
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "instagram_publish_carousel",
    {
      title: "Publish Instagram Carousel",
      description: `Publish 2-10 images as one swipeable feed post. THIS POSTS PUBLICLY AND IMMEDIATELY — the post appears on the live account as soon as the call succeeds, and this tool cannot delete it afterwards. Confirm every image URL, their order, and the caption with the user before calling.

Three-step flow, per Instagram's carousel API:
  1. One container per image, each flagged is_carousel_item
  2. One CAROUSEL container listing those children, carrying the caption
  3. Publish the carousel container

Item containers are created in order, one at a time, so a failure names which image caused it. Containers already created stay valid for 24 hours, so a retry does not have to redo the successful ones — but this tool does not resume; it starts over.

Requirements Instagram enforces:
  - 2-10 items. One image is not a carousel; use instagram_publish_post
  - Every image must be JPEG on a publicly reachable HTTPS URL. PNG is rejected — this is the most common failure, since most render pipelines emit PNG by default
  - The caption belongs to the carousel, not to the items; per-image captions do not exist
  - Counts as ONE post against the 100-per-24-hours limit, however many items it has

Args:
  - image_urls (string[]): 2-10 public HTTPS URLs of JPEGs, in the order they should appear
  - caption (string): Post caption, up to 2200 characters
  - account_id (string): Numeric account ID (defaults to INSTAGRAM_ACCOUNT_ID)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "published": true,
    "media_id": string,           // ID of the live post
    "container_id": string,       // The carousel container
    "item_container_ids": string[],
    "item_count": number,
    "permalink": string           // Public URL, when the API returns it
  }

Examples:
  - "Post these five slides as a carousel" -> image_urls=["https://...01.jpg", ...], caption="..."
  - Don't use when: there is one image (use instagram_publish_post), or the files are PNG (convert first)

Error Handling:
  - "Item 3 of 5 failed" names the offending URL; the usual causes are PNG data, a 404, or a host that blocks Instagram's fetcher
  - Container ERROR on the carousel step after all items succeeded usually means one URL became unreachable mid-flow
  - "The publishing limit is exhausted" when 100 posts have been published in 24 hours`,
      inputSchema: {
        image_urls: z
          .array(z.string().url("each entry of image_urls must be an absolute URL"))
          .min(2, "a carousel needs at least 2 images; use instagram_publish_post for one")
          .max(10, "Instagram allows at most 10 items in a carousel")
          .describe("Public HTTPS URLs of JPEG images, in display order"),
        caption: z
          .string()
          .max(2200, "Instagram captions are capped at 2200 characters")
          .optional()
          .describe("Caption for the carousel as a whole"),
        account_id: z.string().optional().describe("Numeric account ID; defaults to INSTAGRAM_ACCOUNT_ID"),
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
        const accountId = params.account_id ?? requireAccountId();
        const itemIds: string[] = [];

        // Sequential on purpose. Parallel would be faster, but when one of five
        // URLs is wrong the useful output is "item 3 failed", not five
        // simultaneous errors with no ordering.
        for (const [index, url] of params.image_urls.entries()) {
          const position = `Item ${index + 1} of ${params.image_urls.length}`;
          let itemId: string | undefined;

          try {
            const item = await graphPost<{ id?: string }>(`${accountId}/media`, {
              image_url: url,
              is_carousel_item: true,
            });
            itemId = item.id;
          } catch (error) {
            return errorResult(
              `Error: ${position} could not be prepared (${url}). ${describeError(error).replace(/^Error: /, "")}`,
            );
          }

          if (!itemId) {
            return errorResult(
              `Error: ${position} was accepted but the Graph API returned no container ID (${url}).`,
            );
          }

          try {
            await awaitContainer(itemId);
          } catch (error) {
            return errorResult(
              `Error: ${position} failed while processing (${url}). ${describeError(error).replace(/^Error: /, "")} ` +
                "Instagram rejects PNG — confirm the file is really JPEG, not a PNG with a .jpg name.",
            );
          }

          itemIds.push(itemId);
        }

        const carousel = await graphPost<{ id?: string }>(`${accountId}/media`, {
          media_type: "CAROUSEL",
          children: itemIds.join(","),
          caption: params.caption,
        });

        const containerId = carousel.id;
        if (!containerId) {
          return errorResult(
            "Error: All items were prepared but the Graph API returned no carousel container ID. " +
              `The item containers (${itemIds.join(", ")}) stay valid for 24 hours.`,
          );
        }

        await awaitContainer(containerId);

        const published = await graphPost<{ id?: string }>(`${accountId}/media_publish`, {
          creation_id: containerId,
        });

        const mediaId = published.id ?? "";
        let permalink = "";
        if (mediaId) {
          try {
            const media = await graphGet<MediaObject>(mediaId, { fields: "permalink" });
            permalink = media.permalink ?? "";
          } catch {
            // The post is already live; a missing permalink is not worth failing over.
          }
        }

        const payload = {
          published: true,
          media_id: mediaId,
          container_id: containerId,
          item_container_ids: itemIds,
          item_count: itemIds.length,
          ...(permalink ? { permalink } : {}),
        };

        return respond(
          payload,
          (p) =>
            [
              `# Published — carousel, ${p.item_count} items`,
              "",
              `- **Media ID**: ${p.media_id}`,
              `- **Container ID**: ${p.container_id}`,
              ...(p.permalink ? [`- ${p.permalink}`] : []),
            ].join("\n"),
          params.response_format,
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );
}
