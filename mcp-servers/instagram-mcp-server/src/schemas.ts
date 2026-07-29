import { z } from "zod";
import { ResponseFormat } from "./types.js";

export const responseFormatParam = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe(
    "Output format: 'markdown' for a compact human-readable summary, 'json' for the full structured payload",
  );

export const limitParam = z
  .number()
  .int()
  .min(1, "limit must be at least 1")
  .max(100, "limit must not exceed 100")
  .default(25)
  .describe("Maximum items to return, 1-100 (default: 25)");

export const afterParam = z
  .string()
  .optional()
  .describe(
    "Cursor from a previous response's 'next_cursor', for the next page. Omit for the first page.",
  );

/** Instagram object IDs are numeric strings, often 17-18 digits. */
export const instagramIdParam = z
  .string()
  .regex(/^\d+$/, "An Instagram object ID is a numeric string")
  .describe("Numeric Instagram object ID");
