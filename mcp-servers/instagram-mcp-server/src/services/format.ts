import { CHARACTER_LIMIT } from "../constants.js";
import { ResponseFormat } from "../types.js";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
}

export function formatCount(value: number | string | undefined): string {
  if (value === undefined) return "n/a";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : String(value);
}

/** Graph API timestamps look like 2019-04-05T07:56:32+0000. */
export function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "n/a";
  return iso.slice(0, 10);
}

export function truncateText(text: string | undefined, max = 300): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/**
 * Build the MCP result, choosing text by format and enforcing CHARACTER_LIMIT
 * by halving the item array until the response fits. Truncation is always
 * reported in the payload so a clipped result cannot look complete.
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
        const next: Record<string, unknown> = {
          ...current,
          [itemsKey]: items,
          truncated: true,
          truncation_message:
            `Response truncated from ${original.length} to ${items.length} items to stay ` +
            `under the ${CHARACTER_LIMIT}-character limit. Use 'limit' and 'after' to page.`,
        };
        current = next as T;
        text =
          format === ResponseFormat.MARKDOWN
            ? renderMarkdown(current)
            : JSON.stringify(current, null, 2);
      }
    }
  }

  return { content: [{ type: "text", text }], structuredContent: current };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
