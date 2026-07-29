import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PUBLISH_LIMIT_PER_DAY } from "../constants.js";
import { describeError, graphGet, requireAccountId } from "../services/client.js";
import { errorResult, formatCount, respond, truncateText } from "../services/format.js";
import { responseFormatParam } from "../schemas.js";
import type { AccountProfile, GraphListResponse } from "../types.js";

// `id` is the app-scoped ID; `user_id` is the Instagram professional account ID
// that path-scoped endpoints such as /<IG_ID>/media expect. They are different
// values, and using the app-scoped one in a path fails — so request both and
// report user_id as the account ID.
const PROFILE_FIELDS = [
  "id",
  "user_id",
  "username",
  "name",
  "biography",
  "website",
  "profile_picture_url",
  "account_type",
  "media_count",
  "followers_count",
  "follows_count",
].join(",");

export function registerAccountTools(server: McpServer): void {
  server.registerTool(
    "instagram_get_account",
    {
      title: "Get Instagram Account",
      description: `Get the authenticated Instagram professional account's profile and follower statistics.

Call this first when setting up: passing account_id='me' resolves the numeric account ID that every other tool needs, so you do not have to find it by hand.

Args:
  - account_id (string): Numeric account ID, or 'me' for the token's own account (default: 'me')
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "id": string,                 // Numeric account ID — export as INSTAGRAM_ACCOUNT_ID
    "username": string,
    "name": string,               // Display name
    "biography": string,
    "website": string,
    "account_type": string,       // "BUSINESS" or "MEDIA_CREATOR"
    "media_count": number,
    "followers_count": number,
    "follows_count": number,
    "profile_picture_url": string
  }

Examples:
  - "Which account am I connected to?" -> account_id="me"
  - "How many followers do I have?" -> account_id="me", then read followers_count
  - Don't use when: you want post-level metrics — use instagram_get_account_insights

Error Handling:
  - "The access token is invalid or has expired" when the token is stale — Instagram User tokens last 60 days
  - Personal (non-professional) accounts are not supported by the API at all`,
      inputSchema: {
        account_id: z
          .string()
          .default("me")
          .describe("Numeric Instagram account ID, or 'me' for the token's own account"),
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
        const profile = await graphGet<AccountProfile>(params.account_id, {
          fields: PROFILE_FIELDS,
        });

        const payload = {
          // Export this one as INSTAGRAM_ACCOUNT_ID — it is what path-scoped
          // endpoints accept. Fall back to the app-scoped id only if the API
          // omitted user_id, which happens on the Facebook Login path.
          id: profile.user_id ?? profile.id ?? "",
          app_scoped_id: profile.id ?? "",
          username: profile.username ?? "",
          name: profile.name ?? "",
          biography: profile.biography ?? "",
          website: profile.website ?? "",
          account_type: profile.account_type ?? "unknown",
          media_count: profile.media_count ?? 0,
          followers_count: profile.followers_count ?? 0,
          follows_count: profile.follows_count ?? 0,
          profile_picture_url: profile.profile_picture_url ?? "",
        };

        return respond(
          payload,
          (p) => {
            const lines = [`# @${p.username}`, ""];
            if (p.name) lines.push(`- **Name**: ${p.name}`);
            lines.push(`- **Account ID**: ${p.id}`);
            lines.push(`- **Type**: ${p.account_type}`);
            lines.push(`- **Followers**: ${formatCount(p.followers_count)}`);
            lines.push(`- **Following**: ${formatCount(p.follows_count)}`);
            lines.push(`- **Posts**: ${formatCount(p.media_count)}`);
            if (p.website) lines.push(`- **Website**: ${p.website}`);
            lines.push("");
            if (p.biography) lines.push(truncateText(p.biography, 500));
            return lines.join("\n");
          },
          params.response_format,
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "instagram_get_publishing_limit",
    {
      title: "Get Publishing Limit Usage",
      description: `Check how many of the account's 100 daily API-published posts have been used.

Instagram enforces a limit of ${PUBLISH_LIMIT_PER_DAY} API-published posts per rolling 24-hour period, counted at publish time. A carousel counts as one post. Check this before a batch of publishes rather than discovering the limit mid-run.

Args:
  - account_id (string): Numeric account ID (defaults to INSTAGRAM_ACCOUNT_ID)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "account_id": string,
    "quota_usage": number,        // Posts published in the current 24-hour window
    "quota_total": number,        // Always 100
    "remaining": number
  }

Examples:
  - "Can I still post today?" -> account_id defaults to the configured account
  - "How many posts have I published via the API?" -> read quota_usage

Error Handling:
  - Requires the instagram_business_content_publish permission`,
      inputSchema: {
        account_id: z
          .string()
          .optional()
          .describe("Numeric Instagram account ID; defaults to INSTAGRAM_ACCOUNT_ID"),
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
        const data = await graphGet<GraphListResponse<{ quota_usage?: number; config?: { quota_total?: number } }>>(
          `${accountId}/content_publishing_limit`,
          { fields: "config,quota_usage" },
        );

        const entry = data.data?.[0] ?? {};
        const used = entry.quota_usage ?? 0;
        const total = entry.config?.quota_total ?? PUBLISH_LIMIT_PER_DAY;

        const payload = {
          account_id: accountId,
          quota_usage: used,
          quota_total: total,
          remaining: Math.max(0, total - used),
        };

        return respond(
          payload,
          (p) =>
            [
              `# Publishing limit`,
              "",
              `- **Used**: ${p.quota_usage} of ${p.quota_total} in the last 24 hours`,
              `- **Remaining**: ${p.remaining}`,
            ].join("\n"),
          params.response_format,
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );
}
