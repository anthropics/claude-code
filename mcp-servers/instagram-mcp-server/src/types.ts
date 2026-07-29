export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export interface AccountProfile {
  id?: string;
  username?: string;
  name?: string;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  account_type?: string;
  media_count?: number;
  followers_count?: number;
  follows_count?: number;
}

export interface MediaObject {
  id?: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp?: string;
  username?: string;
  like_count?: number;
  comments_count?: number;
  is_comment_enabled?: boolean;
  children?: { data?: Array<{ id?: string; media_type?: string; media_url?: string }> };
}

export interface CommentObject {
  id?: string;
  text?: string;
  timestamp?: string;
  username?: string;
  like_count?: number;
  hidden?: boolean;
  replies?: { data?: CommentObject[] };
  from?: { id?: string; username?: string };
}

export interface InsightValue {
  value?: number | Record<string, number>;
  end_time?: string;
}

export interface InsightMetric {
  name?: string;
  period?: string;
  title?: string;
  description?: string;
  values?: InsightValue[];
  total_value?: { value?: number };
}

export interface Paging {
  cursors?: { before?: string; after?: string };
  next?: string;
  previous?: string;
}

export interface GraphListResponse<T> {
  data?: T[];
  paging?: Paging;
}

export interface GraphErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
    fbtrace_id?: string;
  };
}

/** Publishing container status, returned by GET /<container-id>?fields=status_code. */
export type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
