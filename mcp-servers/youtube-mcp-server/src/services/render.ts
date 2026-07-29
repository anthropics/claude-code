import { formatCount, formatDate, formatDuration, truncateText, videoUrl } from "./format.js";
import type { VideoItem } from "../types.js";

/** Normalized video row shared by search, details, trending, and listing tools. */
export interface VideoRow {
  id: string;
  title: string;
  channel_title?: string;
  channel_id?: string;
  published_at?: string;
  description?: string;
  duration?: string;
  view_count?: string;
  like_count?: string;
  comment_count?: string;
  url: string;
}

/**
 * Render one video as a markdown block. Statistics lines are emitted only when
 * present, so search results (which carry no statistics) stay compact while
 * detail results show the full picture.
 */
export function renderVideo(video: VideoRow): string[] {
  const lines = [`## ${video.title}`];
  const meta: string[] = [];
  if (video.channel_title) meta.push(`**Channel**: ${video.channel_title}`);
  if (video.published_at) meta.push(`**Published**: ${formatDate(video.published_at)}`);
  if (video.duration) meta.push(`**Duration**: ${formatDuration(video.duration)}`);
  if (meta.length) lines.push(`- ${meta.join(" · ")}`);

  const stats: string[] = [];
  if (video.view_count !== undefined) stats.push(`${formatCount(video.view_count)} views`);
  if (video.like_count !== undefined) stats.push(`${formatCount(video.like_count)} likes`);
  if (video.comment_count !== undefined) stats.push(`${formatCount(video.comment_count)} comments`);
  if (stats.length) lines.push(`- ${stats.join(" · ")}`);

  if (video.description) lines.push(`- ${truncateText(video.description, 200)}`);
  lines.push(`- ${video.url}`);
  lines.push("");
  return lines;
}

/** Render a heading, the video blocks, and a paging footer. */
export function renderVideoList(
  heading: string,
  videos: VideoRow[],
  footer?: { total?: number; nextPageToken?: string },
): string {
  const lines = [`# ${heading}`, ""];
  if (footer?.total !== undefined) {
    lines.push(`Matches: ${formatCount(footer.total)} · showing ${videos.length}`, "");
  }
  for (const video of videos) lines.push(...renderVideo(video));
  if (footer?.nextPageToken) {
    lines.push(`_More results available — pass page_token="${footer.nextPageToken}"._`);
  }
  return lines.join("\n");
}

/**
 * Map a raw API video item onto a VideoRow, tolerating partial `part`
 * selections.
 *
 * The id lives in three different places depending on the endpoint: a bare
 * string on `videos.list`, `id.videoId` on `search.list`, and
 * `contentDetails.videoId` on `playlistItems.list`.
 */
export function toVideoRow(item: VideoItem): VideoRow {
  const snippet = item.snippet ?? {};
  const statistics = item.statistics ?? {};
  const contentDetails = item.contentDetails ?? {};

  const id =
    (typeof item.id === "string" ? item.id : item.id?.videoId) ??
    contentDetails.videoId ??
    "";

  return {
    id,
    title: snippet.title ?? "(untitled)",
    channel_title: snippet.channelTitle,
    channel_id: snippet.channelId,
    published_at: snippet.publishedAt,
    description: snippet.description,
    duration: contentDetails.duration,
    view_count: statistics.viewCount,
    like_count: statistics.likeCount,
    comment_count: statistics.commentCount,
    url: videoUrl(id),
  };
}
