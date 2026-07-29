import { z } from "zod";
import { ResponseFormat } from "./types.js";

/** Output format selector, shared by every data-returning tool. */
export const responseFormatParam = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe(
    "Output format: 'markdown' for a compact human-readable summary, 'json' for the full structured payload",
  );

/** Page size. The API itself caps a single page at 50 items. */
export const limitParam = z
  .number()
  .int()
  .min(1, "limit must be at least 1")
  .max(50, "limit must not exceed 50 — the YouTube API caps a page at 50 items")
  .default(10)
  .describe("Maximum number of items to return, 1-50 (default: 10)");

/** Opaque cursor from a previous response's `next_page_token`. */
export const pageTokenParam = z
  .string()
  .optional()
  .describe(
    "Cursor for the next page, taken from a previous response's 'next_page_token'. Omit for the first page.",
  );

/** A YouTube video ID is always 11 characters of URL-safe base64. */
export const videoIdParam = z
  .string()
  .regex(/^[A-Za-z0-9_-]{11}$/, "A video ID is exactly 11 characters, e.g. 'dQw4w9WgXcQ'")
  .describe("YouTube video ID — the 11-character value after 'v=' in a watch URL");

/** Channel IDs are the 'UC...' form, not the @handle or custom URL. */
export const channelIdParam = z
  .string()
  .regex(/^UC[A-Za-z0-9_-]{22}$/, "A channel ID starts with 'UC' and is 24 characters long")
  .describe("YouTube channel ID, starting with 'UC'");
