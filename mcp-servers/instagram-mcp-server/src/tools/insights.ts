import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { describeError, graphGet, requireAccountId } from "../services/client.js";
import { errorResult, formatCount, respond } from "../services/format.js";
import { instagramIdParam, responseFormatParam } from "../schemas.js";
import type { GraphListResponse, InsightMetric } from "../types.js";

interface MetricRow {
  name: string;
  period: string;
  title: string;
  description: string;
  /** Latest scalar value, or the sum across the window for time-series metrics. */
  value: number | null;
  /** Present for demographic breakdowns, which return a map rather than a number. */
  breakdown?: Record<string, number>;
  series?: Array<{ end_time: string; value: number }>;
}

function toMetricRows(metrics: InsightMetric[]): MetricRow[] {
  return metrics.map((metric) => {
    const values = metric.values ?? [];
    const series: Array<{ end_time: string; value: number }> = [];
    let breakdown: Record<string, number> | undefined;
    let total: number | null = metric.total_value?.value ?? null;

    for (const entry of values) {
      if (typeof entry.value === "number") {
        series.push({ end_time: entry.end_time ?? "", value: entry.value });
      } else if (entry.value && typeof entry.value === "object") {
        breakdown = entry.value;
      }
    }

    if (total === null && series.length) {
      total = series.reduce((sum, point) => sum + point.value, 0);
    }

    return {
      name: metric.name ?? "unknown",
      period: metric.period ?? "",
      title: metric.title ?? metric.name ?? "",
      description: metric.description ?? "",
      value: total,
      ...(breakdown ? { breakdown } : {}),
      ...(series.length ? { series } : {}),
    };
  });
}

function renderMetrics(heading: string, rows: MetricRow[]): string {
  if (!rows.length) return `${heading}\n\nNo metric data was returned.`;
  const lines = [`# ${heading}`, ""];
  for (const row of rows) {
    lines.push(`## ${row.title || row.name}`);
    if (row.value !== null) lines.push(`- **Value**: ${formatCount(row.value)}`);
    if (row.period) lines.push(`- **Period**: ${row.period}`);
    if (row.breakdown) {
      const top = Object.entries(row.breakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);
      lines.push(`- **Breakdown** (top ${top.length}):`);
      for (const [key, value] of top) lines.push(`  - ${key}: ${formatCount(value)}`);
    }
    if (row.description) lines.push(`- ${row.description}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function registerInsightTools(server: McpServer): void {
  server.registerTool(
    "instagram_get_media_insights",
    {
      title: "Get Post Insights",
      description: `Get performance metrics for a single post.

Available metrics depend on the media type — reels, stories, and feed posts each expose a different set, and asking for a metric the media does not support fails the whole call. Start with the defaults and narrow from there.

Args:
  - media_id (string): Numeric media ID
  - metrics (string[]): Metric names (default: ["reach", "likes", "comments", "saved", "shares"])
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "media_id": string,
    "metrics": [
      {
        "name": string,
        "title": string,
        "description": string,
        "period": string,
        "value": number | null,
        "series": [ { "end_time": string, "value": number } ]
      }
    ]
  }

Examples:
  - "How did this post do?" -> media_id="17895..." with the default metrics
  - "How many saves?" -> media_id="...", metrics=["saved"]
  - Don't use when: you want account-wide numbers — use instagram_get_account_insights

Error Handling:
  - Requires the instagram_business_manage_insights permission
  - An unsupported metric for the media type fails the whole request; drop it and retry
  - Live videos can only be measured while broadcasting`,
      inputSchema: {
        media_id: instagramIdParam,
        metrics: z
          .array(z.string().min(1))
          .min(1, "Provide at least one metric")
          .max(20)
          .default(["reach", "likes", "comments", "saved", "shares"])
          .describe("Metric names to request"),
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
        const data = await graphGet<GraphListResponse<InsightMetric>>(
          `${params.media_id}/insights`,
          { metric: params.metrics.join(",") },
        );

        const payload = {
          media_id: params.media_id,
          metrics: toMetricRows(data.data ?? []),
        };

        return respond(
          payload,
          (p) => renderMetrics(`Insights for post ${p.media_id}`, p.metrics),
          params.response_format,
          "metrics",
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "instagram_get_account_insights",
    {
      title: "Get Account Insights",
      description: `Get account-level metrics over a time period.

Args:
  - account_id (string): Numeric account ID (defaults to INSTAGRAM_ACCOUNT_ID)
  - metrics (string[]): Metric names (default: ["reach", "follower_count", "profile_views"])
  - period ('day' | 'week' | 'days_28' | 'lifetime'): Aggregation window (default: 'day')
  - metric_type (string): Set to 'total_value' for metrics that require it
  - since (string): ISO 8601 date for the start of the range
  - until (string): ISO 8601 date for the end of the range
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "account_id": string,
    "period": string,
    "metrics": [
      {
        "name": string,
        "title": string,
        "description": string,
        "period": string,
        "value": number | null,        // Sum across the window
        "breakdown": { "<key>": number },  // For demographic metrics
        "series": [ { "end_time": string, "value": number } ]
      }
    ]
  }

Examples:
  - "How is my account doing this week?" -> period="week"
  - "Where is my audience?" -> metrics=["audience_city"], period="lifetime"
  - Don't use when: you want a single post's numbers — use instagram_get_media_insights

Error Handling:
  - Accounts with fewer than 100 followers do not get demographic metrics
  - Account metric data is retained for 90 days
  - Requesting a metric with the wrong period fails; 'lifetime' is required for audience_* metrics`,
      inputSchema: {
        account_id: z.string().optional().describe("Numeric account ID; defaults to INSTAGRAM_ACCOUNT_ID"),
        metrics: z
          .array(z.string().min(1))
          .min(1, "Provide at least one metric")
          .max(20)
          .default(["reach", "follower_count", "profile_views"])
          .describe("Metric names to request"),
        period: z
          .enum(["day", "week", "days_28", "lifetime"])
          .default("day")
          .describe("Aggregation window"),
        metric_type: z
          .string()
          .optional()
          .describe("Set to 'total_value' for metrics that require the aggregated form"),
        since: z.string().optional().describe("ISO 8601 start of the range"),
        until: z.string().optional().describe("ISO 8601 end of the range"),
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
        const data = await graphGet<GraphListResponse<InsightMetric>>(`${accountId}/insights`, {
          metric: params.metrics.join(","),
          period: params.period,
          metric_type: params.metric_type,
          since: params.since,
          until: params.until,
        });

        const payload = {
          account_id: accountId,
          period: params.period,
          metrics: toMetricRows(data.data ?? []),
        };

        return respond(
          payload,
          (p) => renderMetrics(`Account insights (${p.period})`, p.metrics),
          params.response_format,
          "metrics",
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );
}
