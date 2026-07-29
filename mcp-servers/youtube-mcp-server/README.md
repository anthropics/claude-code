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
| `youtube_get_transcript` | 250 | Caption text — **your own uploads only**, needs OAuth |

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

## Transcripts: your own uploads only

`youtube_get_transcript` works — verified against a real channel owner's video —
but only on videos uploaded by the Google account that authorized this server.
That is a limit of the API, not of this implementation, and it is worth
understanding before you set OAuth up.

**An API key cannot download captions at all.** `captions.list` returns track
metadata with a key (HTTP 200), but `captions.download` returns HTTP 401:

> API keys are not supported by this API. Expected OAuth2 access token or other
> authentication credentials that assert a principal.

A key identifies an *application*; the endpoint requires a *principal*.

**OAuth fixes authentication, not ownership.** With a token, `captions.download`
still serves text only to the video's owner — any other account gets HTTP 403.
No scope, consent screen, or setting changes that. So OAuth buys transcripts for
your own channel and nothing else.

**The unofficial route is closed too.** The caption URLs embedded in the public
watch page used to work. Today the watch page still loads (HTTP 200, ~1.2MB,
`captionTracks` present with a `baseUrl`), but fetching that URL returns
**HTTP 200 with a zero-byte body** — verified across `json3`, `srv3`, `vtt`, and
bare XML, and regardless of User-Agent. YouTube gates it behind a
proof-of-origin token bound to a real player session. An earlier version of this
server was built on that route; it never worked and was removed.

For someone else's video, use a browser session — YouTube's own transcript panel
is right there, and a browser is a real player session by definition.

### Setting up OAuth

1. In Google Cloud Console, **APIs & Services → Credentials → Create
   credentials → OAuth client ID**, application type **Desktop app**.
2. Run the authorization flow, signing in as the account that owns the videos:

   ```bash
   node scripts/authorize.mjs
   ```

   It opens a consent page, catches the redirect on a loopback port, and prints
   three exports. Nothing is written to disk — a refresh token is a credential
   and belongs in your shell profile or secret store, not in the repo.

3. Export what it prints:

   ```bash
   export YOUTUBE_OAUTH_CLIENT_ID="..."
   export YOUTUBE_OAUTH_CLIENT_SECRET="..."
   export YOUTUBE_OAUTH_REFRESH_TOKEN="..."
   ```

The scope is `youtube.force-ssl`; the read-only scope is not sufficient for
caption download. If the consent screen is left in **Testing** mode, refresh
tokens expire after 7 days — publish the app for a long-lived one.

Without these variables the tool returns an error naming exactly which are
missing, and the other eight tools are unaffected.

## Tests

```bash
YOUTUBE_API_KEY=... node test/smoke.mjs
```

Spawns a real server process, speaks JSON-RPC over stdio, and calls every
API-key tool against live YouTube — plus a pinned check on the tool surface and
negative cases covering an unknown channel ID, a malformed video ID, and the
transcript tool's behaviour with OAuth absent. All calls are read-only.

```bash
npm run build && node test/srt.test.mjs
```

Unit tests for the caption parser: SRT and WebVTT, multi-line cues, CRLF, cue
settings, inline styling tags, NOTE blocks, and every degenerate input that must
return no cues instead of throwing.

Current status: smoke 13/13, parser 14/14.

**The OAuth download path is verified end to end**, against a channel owner's
own video: `captions.list` resolved the track, `captions.download` returned SRT
over OAuth, and the parser produced timestamped cues. It is not part of the
automated suites, because it needs credentials for an account that owns a video
and those cannot be provisioned in CI. Re-verify it manually after changing
anything in `src/tools/transcript.ts` or `src/services/oauth.ts`.

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
