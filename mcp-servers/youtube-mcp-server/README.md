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

## There is no transcript tool, and that is deliberate

Caption **text** cannot be retrieved by this server for videos it does not own.
Both available routes were tested against the live API and both are closed:

**The official endpoint rejects API keys.** `captions.list` returns track
metadata with a key (HTTP 200), but `captions.download` returns HTTP 401:

> API keys are not supported by this API. Expected OAuth2 access token or other
> authentication credentials that assert a principal.

A key identifies an *application*; that endpoint requires a *principal*. And
adding OAuth would not open this up — `captions.download` serves text only to
the video's owner, so OAuth buys transcripts for your own uploads and nothing
else.

**The unofficial route now returns empty.** The caption URLs embedded in the
public watch page used to work. Today the watch page still loads (HTTP 200,
~1.2MB, `captionTracks` present with a `baseUrl`), but fetching that URL returns
**HTTP 200 with a zero-byte body** — YouTube gates it behind a proof-of-origin
token bound to a real player session.

An earlier version of this server shipped a `youtube_get_transcript` tool built
on that second route. It never worked. It has been removed rather than left in
place, because a tool that always fails is worse than no tool: an agent reads
the name, tries it, burns a turn, and may then be tempted to invent a summary
from the title and description. `youtube_list_caption_tracks` now reports
`text_retrievable: false` and says so in its output for the same reason.

To actually read a transcript:

- **Someone else's video** — use a browser session. YouTube's own transcript
  panel is right there, and a browser is a real player session by definition.
- **Your own uploads** — add OAuth and call `captions.download`. This is
  legitimate and supported; it is simply a different auth model than this
  server implements.
- **At scale** — use a dedicated transcript service, which solves the
  bot-mitigation problem as its actual product.

Logging in with a Google username and password is not a fourth option: Google
blocks programmatic password authentication outright, and ownership — not
being signed in — is what gates `captions.download`.

`test/diagnose-transcript.mjs` reproduces the whole investigation on any machine
with real network access, and will report if YouTube's behaviour ever changes.

## Tests

```bash
YOUTUBE_API_KEY=... node test/smoke.mjs
```

Spawns a real server process, speaks JSON-RPC over stdio, and calls every tool
against live YouTube — plus a pinned check on the tool surface and two negative
cases covering an unknown channel ID and a malformed video ID. All calls are
read-only. The suite exits non-zero on any failure.

Current status: 12/12 passing, with every tool covered.

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
