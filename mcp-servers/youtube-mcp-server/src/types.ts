/** Output format shared by every tool that returns data. */
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export interface Thumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface VideoSnippet {
  publishedAt?: string;
  channelId?: string;
  title?: string;
  description?: string;
  channelTitle?: string;
  tags?: string[];
  categoryId?: string;
  thumbnails?: Record<string, Thumbnail>;
  liveBroadcastContent?: string;
}

export interface VideoStatistics {
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
}

export interface ContentDetails {
  duration?: string;
  definition?: string;
  caption?: string;
  /** Present on playlistItems entries, where the item's own id is the playlist row. */
  videoId?: string;
}

export interface VideoItem {
  id?: string | { videoId?: string; channelId?: string; playlistId?: string };
  snippet?: VideoSnippet;
  statistics?: VideoStatistics;
  contentDetails?: ContentDetails;
}

export interface ChannelItem {
  id?: string;
  snippet?: VideoSnippet & { customUrl?: string; country?: string };
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    videoCount?: string;
  };
  contentDetails?: {
    relatedPlaylists?: { uploads?: string };
  };
}

export interface CommentThreadItem {
  id?: string;
  snippet?: {
    totalReplyCount?: number;
    topLevelComment?: {
      id?: string;
      snippet?: {
        authorDisplayName?: string;
        authorChannelId?: { value?: string };
        textDisplay?: string;
        textOriginal?: string;
        likeCount?: number;
        publishedAt?: string;
        updatedAt?: string;
      };
    };
  };
}

export interface CaptionItem {
  id?: string;
  snippet?: {
    videoId?: string;
    language?: string;
    name?: string;
    trackKind?: string;
    isAutoSynced?: boolean;
    isCC?: boolean;
    isDraft?: boolean;
    status?: string;
    lastUpdated?: string;
  };
}

export interface ApiListResponse<T> {
  kind?: string;
  items?: T[];
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo?: { totalResults?: number; resultsPerPage?: number };
}

/** Shape of a YouTube Data API error body. */
export interface ApiErrorBody {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string; message?: string; domain?: string }>;
  };
}

/** A single caption cue extracted from a transcript track. */
export interface TranscriptCue {
  start: number;
  duration: number;
  text: string;
}
