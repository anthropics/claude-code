import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../constants.js";
import { YouTubeApiError, describeError, ytRequest } from "../services/client.js";
import { errorResult, respond, videoUrl } from "../services/format.js";
import { getAccessToken, oauthConfigured, missingOAuthVars } from "../services/oauth.js";
import { parseCaptions } from "../services/srt.js";
import { responseFormatParam, videoIdParam } from "../schemas.js";
import type { ApiListResponse, CaptionItem, TranscriptCue } from "../types.js";

/** Render seconds as m:ss / h:mm:ss for cue timestamps. */
function stamp(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Download one caption track's text.
 *
 * This is the only call in the server that uses OAuth rather than the API key,
 * because captions.download refuses keys outright: "API keys are not supported
 * by this API. Expected OAuth2 access token ... that assert a principal."
 * Ownership, not merely authentication, is what it enforces — a valid token for
 * an account that does not own the video gets 403.
 */
async function downloadTrack(trackId: string, format: string): Promise<string> {
  const token = await getAccessToken();
  const url = new URL(`${API_BASE_URL}/captions/${encodeURIComponent(trackId)}`);
  url.searchParams.set("tfmt", format);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new YouTubeApiError(408, "timeout", "Caption download timed out.");
    }
    throw new YouTubeApiError(
      0,
      "networkError",
      `Could not reach the caption endpoint: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    let reason = "captionDownloadFailed";
    try {
      reason =
        (JSON.parse(detail) as { error?: { errors?: Array<{ reason?: string }> } }).error
          ?.errors?.[0]?.reason ?? reason;
    } catch {
      // Non-JSON body; keep the generic reason.
    }
    if (response.status === 403) {
      throw new YouTubeApiError(
        403,
        "notVideoOwner",
        "The authorized account does not own this video. captions.download serves caption " +
          "text only to the video's owner — there is no scope or consent screen that grants " +
          "access to someone else's captions. This tool works on your own uploads only.",
      );
    }
    throw new YouTubeApiError(response.status, reason, detail.slice(0, 300) || response.statusText);
  }

  return response.text();
}

export function registerTranscriptTool(server: McpServer): void {
  server.registerTool(
    "youtube_get_transcript",
    {
      title: "Get Video Transcript (own videos only)",
      description: `Download the caption text of a video YOU OWN, as timestamped cues.

SCOPE LIMIT — read before calling: this works only on videos uploaded by the Google account that authorized this server. YouTube's captions.download endpoint enforces ownership, not merely authentication, so a valid token for any other account returns 403. There is no scope, consent screen, or setting that grants access to someone else's captions. For a video you do not own, do not call this — say the transcript is unavailable rather than inferring content from the title and description.

Requires OAuth. Run \`node scripts/authorize.mjs\` in the server directory once, then export YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET, and YOUTUBE_OAUTH_REFRESH_TOKEN. Costs 50 quota units for the track lookup plus 200 for the download.

Args:
  - video_id (string): 11-character video ID, from a video you own
  - language (string): Preferred BCP-47 code, e.g. 'en', 'tr'. Falls back to the first track.
  - include_timestamps (boolean): Prefix each markdown line with its timecode (default: true)
  - max_cues (number): Cap cues returned, 1-5000 (default: 1000)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns JSON of shape:
  {
    "video_id": string,
    "language": string,           // Language actually returned
    "track_id": string,
    "is_auto_generated": boolean, // true when the track is ASR rather than uploaded
    "cue_count": number,
    "duration_seconds": number,
    "truncated": boolean,
    "cues": [ { "start": number, "duration": number, "text": string } ],
    "url": string
  }

Examples:
  - "Summarize my latest upload" -> video_id from youtube_list_channel_videos on your own channel
  - "What did I say about pricing in that video?" -> video_id="...", then search the cues
  - Don't use when: the video belongs to someone else — it will return 403

Error Handling:
  - "The authorized account does not own this video" (403) is the expected result for other people's videos
  - "OAuth is not configured" lists exactly which variables are missing
  - "The refresh token was rejected" usually means the consent screen is still in Testing mode, where refresh tokens expire after 7 days`,
      inputSchema: {
        video_id: videoIdParam,
        language: z
          .string()
          .min(2, "language must be a BCP-47 code such as 'en' or 'tr'")
          .max(10)
          .optional()
          .describe("Preferred caption language code; falls back to the first available track"),
        include_timestamps: z
          .boolean()
          .default(true)
          .describe("Prefix each markdown line with its timecode"),
        max_cues: z
          .number()
          .int()
          .min(1)
          .max(5000)
          .default(1000)
          .describe("Maximum cues to return before truncating"),
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
        if (!oauthConfigured()) {
          return errorResult(
            `Error: OAuth is not configured — missing ${missingOAuthVars().join(", ")}. ` +
              "Caption text cannot be downloaded with an API key. Run `node scripts/authorize.mjs` " +
              "in the server directory to authorize the account that owns the video, then export " +
              "the three variables it prints.",
          );
        }

        // The track list comes from the API-key path; only the download needs OAuth.
        const listed = await ytRequest<ApiListResponse<CaptionItem>>("captions", {
          part: "snippet",
          videoId: params.video_id,
        });

        const tracks = listed.items ?? [];
        if (!tracks.length) {
          return errorResult(
            `Error: Video ${params.video_id} publishes no caption tracks, so there is no transcript to download.`,
          );
        }

        const chosen =
          (params.language
            ? tracks.find((track) => track.snippet?.language === params.language)
            : undefined) ?? tracks[0];

        if (!chosen?.id) {
          const available = tracks.map((track) => track.snippet?.language ?? "?").join(", ");
          return errorResult(
            `Error: No '${params.language}' caption track on ${params.video_id}. Available: ${available}.`,
          );
        }

        const srt = await downloadTrack(chosen.id, "srt");
        const cues: TranscriptCue[] = parseCaptions(srt);

        if (!cues.length) {
          return errorResult(
            `Error: The caption track downloaded but parsed to zero cues (${srt.length} bytes). ` +
              "The track may be empty or in an unexpected format.",
          );
        }

        const clipped = cues.slice(0, params.max_cues);
        const last = clipped[clipped.length - 1];

        const payload = {
          video_id: params.video_id,
          language: chosen.snippet?.language ?? params.language ?? "unknown",
          track_id: chosen.id,
          is_auto_generated: chosen.snippet?.trackKind === "asr",
          cue_count: clipped.length,
          duration_seconds: last ? Math.round(last.start + last.duration) : 0,
          truncated: cues.length > clipped.length,
          cues: clipped,
          url: videoUrl(params.video_id),
        };

        return respond(
          payload,
          (p) => {
            const lines = [
              `# Transcript — ${p.video_id} (${p.language}${p.is_auto_generated ? ", auto-generated" : ""})`,
              "",
              `${p.cue_count} cues · ${stamp(p.duration_seconds)}`,
              "",
            ];
            for (const cue of p.cues) {
              lines.push(params.include_timestamps ? `[${stamp(cue.start)}] ${cue.text}` : cue.text);
            }
            if (p.truncated) {
              lines.push("", `_Truncated at ${p.cue_count} cues — raise max_cues for more._`);
            }
            return lines.join("\n");
          },
          params.response_format,
          "cues",
        );
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );
}
