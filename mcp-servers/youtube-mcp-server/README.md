# youtube-mcp-server

MCP server for the YouTube Data API v3. Speaks stdio, so it runs as a
subprocess of Claude Code rather than as a hosted service.

## Setup

```bash
npm install
npm run build
export YOUTUBE_API_KEY="AIza..."     # 39 characters, from Google Cloud Console
node dist/index.js
```

Get the key from Google Cloud Console: create or pick a project, enable
**YouTube Data API v3**, then Credentials → Create credentials → API key.
Restrict the key to YouTube Data API v3 — an unrestricted key works across
every API enabled on the project if it leaks.

## Tools

| Tool | Quota | Purpose |
|------|-------|---------|
| `youtube_search_videos` | 100 (+1) | Search by keyword, with order/date/channel filters |
| `youtube_get_video_details` | 1 | Metadata + statistics for up to 50 videos per call |
| `youtube_get_trending_videos` | 1 | Trending chart by country and category |
| `youtube_get_channel` | 1 | Channel profile and statistics, by ID or `@handle` |
| `youtube_list_channel_videos` | 2 (+1) | A channel's uploads, newest first |
| `youtube_list_playlist_items` | 1 | Videos in a public playlist |
| `youtube_list_video_comments` | 1 | Top-level comments, by relevance or recency |
| `youtube_list_caption_tracks` | 50 | Which caption languages a video publishes |
| `youtube_get_transcript` | 0 | Transcript text as timestamped cues |

The `+1` is the optional `include_statistics` follow-up call. Every tool
accepts `response_format` (`markdown` by default, `json` for the full payload)
and list tools accept `limit` plus `page_token`.

## Quota

The free allowance is 10,000 units per day, resetting at midnight Pacific.
Search costs 100 units; almost everything else costs 1. That ratio drives two
design choices worth knowing about:

- `youtube_list_channel_videos` resolves the channel and reads its uploads
  playlist (2 units) instead of searching (100 units). Prefer it whenever the
  channel is known.
- `youtube_search_videos` enriches results with statistics through a single
  batched `videos.list` call (1 unit for the whole page), rather than making
  the agent issue a second round trip.

## Transcripts are not part of the Data API

`youtube_get_transcript` does **not** use the Data API, and this is a genuine
limitation rather than an implementation shortcut:

- `captions.list` (used by `youtube_list_caption_tracks`) returns track
  *metadata* with an API key. That works, and is tested.
- `captions.download` returns the actual text, but requires an OAuth token from
  the video's owner. An API key cannot call it for someone else's video.

So `youtube_get_transcript` reads the caption track from the public watch page,
the same approach every transcript library uses. That endpoint is undocumented
and can break whenever YouTube changes its player payload, or return HTTP 403
from networks that YouTube treats as automated.

**This tool's success path is unverified, and it is known to fail in at least
one real environment.** It was written against the documented player payload
format but could not be exercised during development: the sandbox's egress proxy
refuses CONNECT to `youtube.com`, so every attempt there fails with a 403 that
says nothing about YouTube's actual behaviour. A first real-world test also
failed. Its *failure* path is tested and returns a clean in-band error.

To find out why it fails on a given machine, run the diagnostic — it bypasses
MCP and reports what YouTube returns at each stage:

```bash
node test/diagnose-transcript.mjs [videoId]
```

It distinguishes the cases that need different fixes: a refused watch page, a
consent or bot-check interstitial, a payload whose shape changed, a caption URL
gated behind a proof-of-origin token, and a stale build. Paste its full output
when reporting a transcript problem.

If YouTube is serving bot mitigation, no plain HTTP client can get past it, and
the realistic options are an OAuth-authorized `captions.download` (your own
videos only), a real browser session, or a third-party transcript service.

Everything else in the table above is covered by the smoke test.

## Tests

```bash
YOUTUBE_API_KEY=... node test/smoke.mjs
```

Spawns a real server process, speaks JSON-RPC over stdio, and calls every
Data API tool against live YouTube — plus two negative cases covering an
unknown channel ID and a malformed video ID. All calls are read-only. The
suite exits non-zero on any failure.

Current status: 11/11 passing, `youtube_get_transcript` excluded for the reason
above.

## Design notes

- **Errors are mapped by reason, not status.** YouTube returns a machine-readable
  `reason` alongside the HTTP code; a 403 can mean an exhausted quota, a key
  restriction, or a disabled API, and each needs a different fix. `describeError`
  in `src/services/client.ts` turns each into a message that names the fix.
- **IDs are validated before the network call.** A video ID is 11 characters and
  a channel ID is `UC` plus 22 — the Zod schemas reject malformed input rather
  than spending quota to learn the same thing.
- **`@handle` is accepted anywhere a channel ID is.** Agents rarely have the raw
  `UC...` ID, and forcing a lookup would cost a 100-unit search.
- **Responses are capped at 25,000 characters.** Over that, the item array is
  halved until it fits and the payload reports what was dropped, so a truncated
  result is never mistaken for a complete one.
