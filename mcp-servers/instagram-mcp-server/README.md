# instagram-mcp-server

MCP server for the Instagram Graph API, covering profile and media reads,
comment moderation, insights, and content publishing for Instagram
professional accounts. Speaks stdio.

## Verification status

**Every read tool has been run against a live Instagram professional account**
(Graph API `v25.0`, Instagram Login path). Confirmed working:

| Tool | Verified |
|---|---|
| `instagram_get_account` | profile, follower counts, both ID forms |
| `instagram_list_media` | feed listing, cursor pagination, carousel/reel typing |
| `instagram_get_media` | single post including carousel children |
| `instagram_get_media_insights` | per-post reach and engagement |
| `instagram_get_account_insights` | account metrics over a period |
| `instagram_get_publishing_limit` | quota usage |
| `instagram_list_comments` | text, author, likes, timestamps, IDs |
| `instagram_publish_post` | image story published to a live account |
| `instagram_publish_carousel` | **not verified** — schema and local paths only |

One practical constraint found the hard way: **feed posts require an aspect
ratio between 4:5 and 1.91:1**, and a 784×1168 image (0.67) is outside it.
Stories accept the taller shape, which makes them the better first test as well
as the safer one.

`instagram_publish_post` is **verified for image stories**: container creation,
the status check, `media_publish`, and the permalink lookup all ran against a
live account and produced a story visible on the profile. Not exercised by that
run, and still unverified: the asynchronous transcode polling that video and
reel containers need (an image container is `FINISHED` immediately), and feed
posts, which impose an aspect-ratio range stories do not.

`instagram_publish_carousel` implements Instagram's three-step album flow: one
container per image flagged `is_carousel_item`, then a `CAROUSEL` container
listing those children and carrying the caption, then `media_publish`. Item
containers are created **one at a time**, so a failure can name which image
caused it — with five URLs, "item 3 of 5" is worth more than five simultaneous
errors in arbitrary order.

**It has not been run against the Graph API.** The endpoints and parameter
names come from Meta's documentation, and it shares the client, container
polling, and error mapping with the verified single-image path — but the
carousel endpoints themselves are unexercised. Two things to expect on the
first real run:

- **JPEG only.** Instagram rejects PNG, and most render pipelines emit PNG by
  default. This is the likeliest first failure, and it surfaces as a container
  ending in `ERROR` rather than as anything mentioning the format.
- **Every URL must be publicly fetchable by Meta's servers**, not merely by
  your browser. A host that blocks unknown user agents fails here while looking
  fine in a tab.

`instagram_reply_to_comment` is the one tool never called. Testing it means
posting a public reply under a real person's comment on a live account, which
is not something to do to tick a box. It shares the verified client and error
handling with everything else; only the endpoint itself is unexercised.

`node test/protocol.mjs` (30/30) covers what needs no credentials: tool
registration, annotation correctness, schema validation, and every local
pre-flight error path — including a one-image carousel and an eleven-image one,
both rejected before any container is created. It deliberately does not talk to
the Graph API.

Two observations from live use worth knowing:

- **Insight metric names and descriptions come back localized** to the
  account's language, not in English. The metric `name` field stays stable;
  `title` and `description` do not.
- **An app in Development mode reads no live data, and says nothing about it.**
  This is the single most expensive thing to not know. While the app is in
  Development mode, `/<media-id>/comments` returns
  `{"data":[],"paging":{"cursors":{...}}}` — HTTP 200, no error — on a post
  whose `comments_count` is non-zero, and requesting `comments{...}` as a
  nested field drops the field from the response entirely. Switching the app to
  Live (the **Publish** button in the App Dashboard) makes the same call return
  the comments immediately.

  The tell is the cursors: Meta mints `before`/`after` values pointing at
  content it then withholds, and on a post with exactly one comment the two are
  identical. A genuinely empty collection does not produce that.

  Writes are unaffected — publishing worked in Development mode — so a setup
  can look half-broken in a way that suggests a permissions problem. It is not.
  These were each ruled out before the real cause was found: the token's scopes
  (verified granted at issue time), `is_comment_enabled` (true), the client
  (bare `curl` behaved identically), and the comments being replies or the
  owner's own (confirmed top-level, by other people, in the app).

- **Comment authors need the `from` expansion.** On the Instagram Login path the
  `username` field on a comment comes back empty; the author is only populated
  through `from{id,username}`. The client requests both.

## Setup

```bash
npm install
npm run build

export INSTAGRAM_ACCESS_TOKEN="..."      # required
export INSTAGRAM_ACCOUNT_ID="17841..."   # optional; discover it with instagram_get_account
export INSTAGRAM_API_HOST="graph.instagram.com"   # or graph.facebook.com
export INSTAGRAM_API_VERSION="v25.0"

node dist/index.js
```

`scripts/authorize.mjs` prints both variables at the end, so you should not need
to look either up by hand.

### What Meta requires before any of this works

1. An Instagram **Business or Creator** account. Personal accounts have no API.
2. A Facebook Page linked to that account — only for the Facebook Login path.
   The Instagram Login path this server defaults to does not need one.
3. An app registered in the Meta App Dashboard, with the **Instagram** product
   added.
4. An access token with the right scopes.
5. **The app switched to Live mode** — the **Publish** button in the App
   Dashboard. In Development mode every read of live data returns empty without
   an error, which is by far the most confusing failure here. See the notes at
   the end.
6. **App Review**, only if the app will serve accounts you do not own. Standard
   Access covers accounts you own and have added in the App Dashboard.

### Getting a token

**Use the OAuth flow, not the Dashboard button.** The App Dashboard's
**Generate token** is quicker and issues a 60-day token directly, but it grants
only the permissions currently ticked in the app's use-case configuration —
which in practice meant a token that could read the profile and media but
silently returned nothing for comments. The OAuth flow requests scopes
explicitly in the authorization URL, so what you ask for is what you get, and
the script prints the granted list back so you can check rather than assume.

The Dashboard button is still fine when you only need profile and media reads.

```bash
export INSTAGRAM_APP_ID="..."       # App Dashboard > Instagram > API setup with Instagram login
export INSTAGRAM_APP_SECRET="..."
node scripts/authorize.mjs                              # prints the authorization URL
node scripts/authorize.mjs --code "<paste redirect URL>" # exchanges it for a 60-day token
```

The flow is two steps rather than the single-command loopback used by the
YouTube server, and the reason is worth knowing before you fight it: **Meta
validates redirect URIs by fetching them from its own servers**, so it rejects
plain `http://` URIs — including `http://localhost`. Register
`https://localhost:8573/callback` instead (App Dashboard → Instagram → API setup
with Instagram login → Business login settings → OAuth redirect URIs). Nothing
serves TLS there, so after authorizing the browser lands on an SSL error page —
that is expected. The authorization code is in the address bar; paste the whole
URL into `--code` and the script strips the `#_` trailer Meta appends.

Codes are single-use and expire in an hour. On a failed exchange, reopen the
authorization URL for a fresh one rather than retrying the same code.

The whole flow is verified against a live account: the code exchange, the
short-to-long-lived upgrade, and the `/me` lookup that resolves the account ID
all work, and the script reports the granted permissions so a narrow token is
visible immediately rather than showing up later as an empty result.

Long-lived tokens last 60 days and can be extended without repeating the browser
flow:

```bash
node scripts/authorize.mjs --refresh
```

### When authorization fails

**`Insufficient Developer Role`** — being an Admin on the app is not enough. The
Instagram account itself needs the **Instagram Tester** role, which is a
different thing from the plain "Tester" role in the same dialog:

1. App Dashboard → **App roles → Roles** → **Add People** → select **Instagram
   Tester** → enter the Instagram username → Add.
2. Sign in as that account and accept at
   <https://www.instagram.com/accounts/manage_access/> → **Tester Invites** →
   **Accept**. The dashboard status goes from `Pending` to `Active`.

Three other things produce the same or a similarly opaque failure:

- **The account is private.** Tokens are only issued for public profiles.
- **The account is still personal.** Only professional (Business or Creator)
  accounts can hold the tester role.
- **The browser is signed in as a different Instagram account.** Authorization
  follows the current session, so with several accounts the fix is usually an
  incognito window signed into the right one.

**`Error saving redirect URLs`** in the dashboard — Meta fetches the URI to
check it resolves, so `http://localhost` is rejected. Use
`https://localhost:8573/callback`, or `https://127.0.0.1:8573/callback` if that
is also refused; accounts differ on which one they accept.

### Two login flows

| | Instagram Login | Facebook Login |
|---|---|---|
| Host | `graph.instagram.com` | `graph.facebook.com` |
| Token | Instagram User access token | Facebook Page access token |
| Read | `instagram_business_basic` | `instagram_basic` + `pages_read_engagement` |
| Comments | `instagram_business_manage_comments` | `instagram_manage_comments` |
| Publish | `instagram_business_content_publish` | `instagram_content_publish` |
| Insights | `instagram_business_manage_insights` | `instagram_manage_insights` |

Both expose the same paths, so switching is a matter of `INSTAGRAM_API_HOST`
and the token. The default is the Instagram Login path.

## Tools

| Tool | Writes | Purpose |
|------|--------|---------|
| `instagram_get_account` | | Profile, follower counts, and the account ID |
| `instagram_get_publishing_limit` | | Posts used against the 100-per-24h cap |
| `instagram_list_media` | | Published posts, newest first, cursor-paginated |
| `instagram_get_media` | | One post in full, including carousel children |
| `instagram_publish_post` | **yes** | Publish an image, video, reel, or story |
| `instagram_publish_carousel` | **yes** | Publish 2-10 images as one swipeable post |
| `instagram_list_comments` | | Comments on a post |
| `instagram_reply_to_comment` | **yes** | Public reply to a comment |
| `instagram_get_media_insights` | | Per-post metrics |
| `instagram_get_account_insights` | | Account metrics over a period |

### The three write tools publish publicly and immediately

`instagram_publish_post`, `instagram_publish_carousel`, and
`instagram_reply_to_comment` produce content that is visible to everyone the
moment the call succeeds, and none of them can undo it. All three say so in
their tool descriptions so an agent reading the schema sees the warning. Confirm
exact wording, media, and — for a carousel — the order of the images with the
user before calling.

## Limits Meta enforces

- **200 API calls per user per hour.** Code 4/17/32 means you hit it.
- **100 API-published posts per rolling 24 hours.** Carousels count as one.
- **Images must be JPEG**, hosted on a publicly reachable URL — Instagram
  fetches the media server-side, so local paths and short-lived signed URLs fail.
- **Account metrics are retained for 90 days**, and demographic metrics need at
  least 100 followers.
- **No triggers.** There is no way for this server to wake on a new comment or
  DM; it only acts inside a conversation you start. Meta's webhooks can do that,
  but they need a public HTTPS endpoint, which is outside this server's scope.

## Design notes

- **Errors are mapped by Meta's numeric code, not HTTP status.** Nearly every
  Graph API failure is HTTP 400; the code is what distinguishes an expired token
  (190) from a missing permission (200) from an exhausted publishing quota (9007).
  `describeError` names the specific fix for each, and surfaces Meta's own
  `error_user_msg` when present.
- **Publishing polls the container.** Video and reel containers transcode
  asynchronously, and publishing one before it reaches `FINISHED` fails. The
  publish tool polls for up to 60 seconds and, on timeout, tells you the
  container stays valid for 24 hours rather than implying the post was lost.
- **Write parameters go in the request body**, so a 2200-character caption
  cannot overflow a URL length limit.
- **Pre-flight validation is local.** Malformed IDs and contradictory publish
  arguments are rejected before a request is made, which matters against a
  200-per-hour budget.

## Tests

```bash
node test/protocol.mjs
```

No credentials needed — and none used. See the verification section above for
exactly what this does and does not cover.
