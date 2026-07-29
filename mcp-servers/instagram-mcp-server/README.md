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
| `instagram_list_comments` | returns cleanly; see the note below |

**The two write tools are deliberately unverified.** `instagram_publish_post`
and `instagram_reply_to_comment` produce public, irreversible content on a live
account, so testing them means actually posting. Their request construction
follows the same verified client path as the read tools, but the calls
themselves have never been made.

`node test/protocol.mjs` (25/25) covers what needs no credentials: tool
registration, annotation correctness, schema validation, and every local
pre-flight error path. It deliberately does not talk to the Graph API.

Two observations from live use worth knowing:

- **Insight metric names and descriptions come back localized** to the
  account's language, not in English. The metric `name` field stays stable;
  `title` and `description` do not.
- **`comments_count` can exceed what the comments edge returns, and the cause
  is not (only) permissions.** A carousel reporting `comments_count: 2` returns
  `{"data":[],"paging":{"cursors":{...}}}` from `/<media-id>/comments`, and
  requesting `comments{...}` as a nested field drops the field from the
  response entirely. Neither produces an error. This persists on a token that
  demonstrably holds `instagram_business_manage_comments` — the granted scope
  list was checked at issue time — so a narrow token is not the explanation,
  and the real cause is still open. Treat `comments_count` as an upper bound.

  A narrow token does produce the same symptom, though, so rule that out
  first: `authorize.mjs` prints the granted permissions when it issues a
  token, which is the cheapest way to check.

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
5. **App Review**, only if the app will serve accounts you do not own. Standard
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
| `instagram_list_comments` | | Comments on a post |
| `instagram_reply_to_comment` | **yes** | Public reply to a comment |
| `instagram_get_media_insights` | | Per-post metrics |
| `instagram_get_account_insights` | | Account metrics over a period |

### The two write tools publish publicly and immediately

`instagram_publish_post` and `instagram_reply_to_comment` produce content that
is visible to everyone the moment the call succeeds, and neither can undo it.
Both say so in their tool descriptions so an agent reading the schema sees the
warning. Confirm exact wording and media with the user before calling either.

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
