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
| `youtube_get_transcript` | 0 / 250 | Captions for any public video via yt-dlp; OAuth fallback for own uploads |

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

## Transcripts

`youtube_get_transcript` reads any public video's captions, and reports which of
two paths produced the text in the payload's `source` field.

**yt-dlp — preferred, any public video, no quota cost.** Needs `yt-dlp` on PATH
plus a JS runtime for YouTube's challenge step; `brew install yt-dlp` supplies
both, since deno arrives as a dependency. Without the JS runtime yt-dlp never
writes the subtitle file, so prefer Homebrew over pip unless you are supplying
deno or node to yt-dlp yourself.

**captions.download via OAuth — fallback, your own uploads only.** Used when
yt-dlp is unavailable. Costs 250 quota units and returns 403 for any video the
authorizing account does not own, because that endpoint enforces ownership
rather than authentication: an API key is rejected outright ("API keys are not
supported by this API. Expected OAuth2 access token ... that assert a
principal"), and OAuth only widens it as far as your own channel.

### Why the official route is not enough

Neither documented path reaches someone else's captions, which is what makes
yt-dlp the primary one rather than a convenience:

- `captions.download` gates on ownership, as above.
- The timedtext URL embedded in the watch page answers **HTTP 200 with an empty
  body** unless the request carries an *attested* proof-of-origin token. A
  cold-start token is not sufficient.
- InnerTube's `get_transcript` returns 400 `failedPrecondition` on the WEB
  context, and the ANDROID/IOS/TV contexts now fail before reaching captions.

yt-dlp solves that challenge and tracks YouTube's changes upstream, which is the
argument for shelling out to it instead of reimplementing BotGuard here.

### What to expect

- **It will break periodically.** When YouTube changes the challenge, the tool
  fails until yt-dlp ships a fix. That is inherent to the approach rather than a
  defect here — `source` says which path answered, so diagnosis is quick.
- **It sits outside the Data API's terms.** Automated access to watch pages is
  not what the API sanctions. For personal use against public captions that is a
  terms question rather than a technical one, but it is worth knowing before
  running this on someone else's behalf or in a shared deployment.
- **A publisher's own track beats a machine translation.** Asking for `tr` on an
  English video yields the English track rather than YouTube's translation of an
  ASR transcript, since those error rates compound. `language` reports what
  actually arrived, so a caller can see the substitution and translate
  downstream with full context.

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

Without these variables the transcript tool falls back to yt-dlp, and the other
eight tools are unaffected. OAuth only matters when yt-dlp is unavailable and the
video is your own.

## Tests

```bash
YOUTUBE_API_KEY=... node test/smoke.mjs
```

Spawns a real server process, speaks JSON-RPC over stdio, and calls every
API-key tool against live YouTube — plus a pinned check on the tool surface and
negative cases covering an unknown channel ID, a malformed video ID, and the
transcript tool's behaviour with OAuth absent. All calls are read-only.

```bash
npm run build
node test/srt.test.mjs     # SRT/WebVTT parser
node test/ytdlp.test.mjs   # json3 parser, both track kinds, from real fixtures
```

The parsers carry the weight, so they are tested directly: the two caption
formats do not share a shape, and an ASR track in particular pads with empty
events and splits text at the word level.

Current status: smoke 13/13, all unit suites passing.

**The OAuth download path is verified end to end**, against a channel owner's
own video: `captions.list` resolved the track, `captions.download` returned SRT
over OAuth, and the parser produced timestamped cues. Neither transcript path is
in the automated suites — one needs credentials for an account that owns a video,
the other needs yt-dlp and network access to YouTube. Re-verify both by hand
after touching `src/tools/transcript.ts`, `src/services/oauth.ts`, or
`src/services/ytdlp.ts`.

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
