// =============================================================================
// API Types - Match backend serializers
// =============================================================================

export interface User {
  id: string;
  email: string;
  full_name: string;
  onboarding_completed: boolean;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner: string;
  owner_email: string;
  created_at: string;
  updated_at: string;
}

export interface VoiceFingerprint {
  id: string;
  brand: string;
  sample_phrases: string[];
  vocabulary_level: "simple" | "conversational" | "technical";
  humor_style: string;
  opening_patterns: string[];
  closing_patterns: string[];
  banned_phrases: string[];
  samples_analyzed: number;
  last_learned_at: string | null;
  updated_at: string;
}

export interface Brand {
  id: string;
  workspace: string;
  name: string;
  niche: string;
  target_audience: string;
  primary_goal: "growth" | "monetize" | "authority";
  voice: VoiceFingerprint | null;
  created_at: string;
  updated_at: string;
}

export interface SourceSample {
  id: string;
  brand: string;
  source_type: "paste" | "file" | "url" | "transcript";
  title: string;
  raw_text: string;
  word_count: number;
  analyzed: boolean;
  created_at: string;
}

export interface Transcript {
  id: string;
  brand: string;
  title: string;
  source_type: "upload" | "paste" | "url";
  source_url: string;
  raw_text: string;
  segments_json: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  duration_seconds: number | null;
  word_count: number;
  language: string;
  status: "processing" | "ready" | "failed";
  error_message: string;
  clips_count: number;
  created_at: string;
}

export interface Clip {
  id: string;
  transcript: string;
  start_time: number;
  end_time: number;
  text: string;
  word_count: number;
  hook_score: number;
  viral_score: number;
  topic_tags: string[];
  suggested_caption: string;
  status: "detected" | "approved" | "rejected" | "published";
  duration_seconds: number;
  created_at: string;
}

export interface ContentPlan {
  id: string;
  brand: string;
  week_start: string;
  status: "draft" | "active" | "archived";
  plan_metadata: Record<string, unknown>;
  items_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlanItem {
  id: string;
  content_plan: string;
  day_of_week: number;
  slot: string;
  scheduled_time: string | null;
  platform: Platform;
  topic: string;
  angle: string;
  intent: string;
  source_clip: string | null;
  source_transcript: string | null;
  status: PlanItemStatus;
  created_at: string;
}

export interface DraftVersion {
  id: string;
  draft: string;
  version: number;
  content: string;
  metadata: Record<string, unknown>;
  created_by: "ai" | "user";
  regen_feedback: string;
  created_at: string;
}

export interface Draft {
  id: string;
  plan_item: string;
  platform: Platform;
  current_version: number;
  quality_score: number;
  quality_flags: Record<string, unknown>;
  status: DraftStatus;
  current_content: string | null;
  versions: DraftVersion[];
  created_at: string;
  updated_at: string;
}

export interface GenerationJob {
  id: string;
  workspace: string;
  job_type: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  result: Record<string, unknown> | null;
  error_message: string;
  created_at: string;
  completed_at: string | null;
}

export interface Subscription {
  id: string;
  workspace: string;
  plan: "free" | "creator" | "pro" | "agency";
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  limits: {
    generations_per_month: number;
    transcription_minutes_per_month: number;
    brands: number;
    scheduled_posts: number;
    team_seats: number;
    price_monthly: number;
  };
  current_usage: {
    generations: number;
    transcription_minutes: number;
    brands: number;
    scheduled_posts: number;
  };
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

// Enums
export type Platform =
  | "youtube_short"
  | "tiktok"
  | "x"
  | "instagram_reel"
  | "newsletter"
  | "youtube_video"
  | "podcast_episode";

export type PlanItemStatus =
  | "planned"
  | "drafting"
  | "ready"
  | "approved"
  | "scheduled"
  | "published"
  | "failed";

export type DraftStatus =
  | "generating"
  | "ready_for_review"
  | "approved"
  | "needs_regen"
  | "scheduled"
  | "published"
  | "failed";

// API Response Types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface JobResponse {
  status: "queued";
  job_id: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}
