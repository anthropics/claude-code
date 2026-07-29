import { CHARACTER_LIMIT } from "../constants.js";
import { ResponseFormat } from "../types.js";

/** Minimal shape of an MCP tool result, kept local to avoid SDK type churn. */
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
}

/** Render "1234567" as "1,234,567"; pass through anything non-numeric. */
export function formatCount(value: string | number | undefined): string {
  if (value === undefined) return "n/a";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : String(value);
}

/** Convert an ISO 8601 duration (PT1H2M3S) into 1:02:03. */
export function formatDuration(iso: string | undefined): string {
  if (!iso) return "n/a";
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return iso;
  const [, d, h, m, s] = match;
  const hours = Number(h ?? 0) + Number(d ?? 0) * 24;
  const minutes = Number(m ?? 0);
  const seconds = Number(s ?? 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** Render an ISO timestamp as YYYY-MM-DD, dropping the time component. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return "n/a";
  return iso.slice(0, 10);
}

/** Strip HTML tags and decode the few entities YouTube commonly emits. */
export function stripHtml(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/** Clip long free text so one verbose description can't dominate a response. */
export function truncateText(text: string | undefined, max = 300): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function videoUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function channelUrl(id: string): string {
  return `https://www.youtube.com/channel/${id}`;
}

/**
 * Build the MCP result for a tool, choosing the text representation by format
 * and enforcing CHARACTER_LIMIT.
 *
 * When the rendered text is too large, the array at `itemsKey` is halved
 * repeatedly until the response fits. The payload then reports what was
 * dropped, so a truncated result is never mistaken for a complete one.
 */
export function respond<T extends Record<string, unknown>>(
  payload: T,
  renderMarkdown: (payload: T) => string,
  format: ResponseFormat,
  itemsKey?: keyof T & string,
): ToolResult {
  let current = payload;
  let text =
    format === ResponseFormat.MARKDOWN
      ? renderMarkdown(current)
      : JSON.stringify(current, null, 2);

  if (text.length > CHARACTER_LIMIT && itemsKey) {
    const original: unknown = current[itemsKey];
    if (Array.isArray(original)) {
      let items: unknown[] = original;
      while (text.length > CHARACTER_LIMIT && items.length > 1) {
        items = items.slice(0, Math.max(1, Math.floor(items.length / 2)));
        // The spread widens T, so rebuild through an index signature and narrow
        // back — the shape is unchanged apart from the shortened array.
        const next: Record<string, unknown> = {
          ...current,
          [itemsKey]: items,
          truncated: true,
          truncation_message:
            `Response truncated from ${original.length} to ${items.length} items to stay ` +
            `under the ${CHARACTER_LIMIT}-character limit. Use the 'limit' and 'page_token' ` +
            `parameters to page through the full result set.`,
        };
        current = next as T;
        text =
          format === ResponseFormat.MARKDOWN
            ? renderMarkdown(current)
            : JSON.stringify(current, null, 2);
      }
    }
  }

  return {
    content: [{ type: "text", text }],
    structuredContent: current,
  };
}

/** Build an MCP error result. Errors are reported in-band, not as protocol faults. */
export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
