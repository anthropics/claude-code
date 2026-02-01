import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function getPlatformLabel(platform: string) {
  const labels: Record<string, string> = {
    youtube_short: "YouTube Short",
    tiktok: "TikTok",
    x: "X/Twitter",
    instagram_reel: "Instagram Reel",
    newsletter: "Newsletter",
    youtube_video: "YouTube Video",
    podcast_episode: "Podcast",
  };
  return labels[platform] || platform;
}

export function getPlatformColor(platform: string) {
  const colors: Record<string, string> = {
    youtube_short: "bg-red-500",
    tiktok: "bg-black",
    x: "bg-blue-400",
    instagram_reel: "bg-gradient-to-r from-purple-500 to-pink-500",
    newsletter: "bg-green-500",
    youtube_video: "bg-red-600",
    podcast_episode: "bg-purple-600",
  };
  return colors[platform] || "bg-gray-500";
}

export function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    // Clip statuses
    detected: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    published: "bg-blue-100 text-blue-800",

    // Draft statuses
    generating: "bg-purple-100 text-purple-800",
    ready_for_review: "bg-yellow-100 text-yellow-800",
    needs_regen: "bg-orange-100 text-orange-800",
    scheduled: "bg-blue-100 text-blue-800",

    // Plan statuses
    planned: "bg-gray-100 text-gray-800",
    drafting: "bg-purple-100 text-purple-800",
    ready: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",

    // Transcript statuses
    processing: "bg-yellow-100 text-yellow-800",

    // Job statuses
    queued: "bg-gray-100 text-gray-800",
    running: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function getDayName(dayOfWeek: number) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return days[dayOfWeek] || "Unknown";
}

export function getWeekDates(weekStart: string) {
  const start = new Date(weekStart);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }
  return dates;
}
