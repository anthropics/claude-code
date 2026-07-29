#!/usr/bin/env node
/**
 * Diagnose why youtube_get_transcript fails, on a machine that can actually
 * reach youtube.com.
 *
 *   node test/diagnose-transcript.mjs [videoId]
 *
 * This bypasses MCP entirely and reproduces the tool's fetch step by step,
 * reporting what YouTube actually returned at each stage. It exists because the
 * transcript path cannot be exercised from the sandbox this server was written
 * in — the egress proxy refuses CONNECT to youtube.com, so every attempt there
 * fails for a reason that tells you nothing about the real failure.
 *
 * Paste the whole output when reporting a transcript problem.
 */

const videoId = process.argv[2] ?? "kkBFmwkDzdo";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

function line(label, value) {
  console.log(`${label.padEnd(26)} ${value}`);
}

console.log(`\n=== transcript diagnosis for ${videoId} ===\n`);

// Stage 1 — can we reach the watch page at all?
let html = "";
try {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  line("watch page status", response.status);
  line("content-type", response.headers.get("content-type") ?? "(none)");
  html = await response.text();
  line("body size", `${html.length} chars`);

  if (!response.ok) {
    console.log("\nDIAGNOSIS: the watch page itself was refused.");
    console.log("If this is 403 from a corporate proxy or VPN, that is the cause.");
    process.exit(1);
  }
} catch (error) {
  line("watch page status", `network error: ${error.message}`);
  console.log("\nDIAGNOSIS: could not connect at all — DNS, proxy, or firewall.");
  process.exit(1);
}

// Stage 2 — did YouTube serve a real player page, or an interstitial?
const markers = {
  ytInitialPlayerResponse: html.includes("ytInitialPlayerResponse"),
  captionTracks: html.includes("captionTracks"),
  consentPage: /consent\.youtube\.com|CONSENT_FLOW|before you continue/i.test(html),
  botCheck: /captcha|unusual traffic|verify you are human|not a robot/i.test(html),
  signInWall: /sign in to confirm|confirm you.{0,5}re not a bot/i.test(html),
};
console.log("");
for (const [name, present] of Object.entries(markers)) {
  line(name, present ? "PRESENT" : "absent");
}

if (markers.consentPage || markers.botCheck || markers.signInWall) {
  console.log(
    "\nDIAGNOSIS: YouTube served an interstitial rather than the player page.\n" +
      "This is the bot-mitigation path — a plain HTTP client cannot get past it.\n" +
      "Transcripts will need a real browser session or an OAuth-authorized download.",
  );
  process.exit(1);
}

if (!markers.captionTracks) {
  console.log(
    "\nDIAGNOSIS: the page loaded but carries no captionTracks.\n" +
      "Either the video publishes no captions, or YouTube moved them out of the\n" +
      "inline payload. Cross-check with youtube_list_caption_tracks, which uses the\n" +
      "official API — if that lists tracks and this does not, the payload format changed.",
  );
  process.exit(1);
}

// Stage 3 — can we parse the track list the tool expects?
const match = /"captionTracks":(\[.*?\])/.exec(html);
if (!match) {
  console.log(
    "\nDIAGNOSIS: captionTracks appears in the page but the tool's regex did not match it.\n" +
      "The surrounding JSON shape changed; the extraction needs updating.",
  );
  const near = html.indexOf("captionTracks");
  console.log(`\ncontext:\n${html.slice(Math.max(0, near - 100), near + 400)}`);
  process.exit(1);
}

let tracks;
try {
  tracks = JSON.parse(match[1]);
} catch (error) {
  console.log(`\nDIAGNOSIS: captionTracks matched but is not valid JSON: ${error.message}`);
  console.log(`\nraw:\n${match[1].slice(0, 500)}`);
  process.exit(1);
}

console.log("");
line("tracks found", tracks.length);
for (const track of tracks) {
  line(`  ${track.languageCode ?? "?"} (${track.kind ?? "standard"})`, track.baseUrl ? "has baseUrl" : "NO baseUrl");
}

const chosen = tracks[0];
if (!chosen?.baseUrl) {
  console.log("\nDIAGNOSIS: tracks are listed but carry no download URL.");
  process.exit(1);
}

// Stage 4 — does the caption URL actually serve text?
try {
  const captionResponse = await fetch(`${chosen.baseUrl}&fmt=json3`, {
    headers: { "User-Agent": UA },
  });
  console.log("");
  line("caption fetch status", captionResponse.status);
  const body = await captionResponse.text();
  line("caption body size", `${body.length} chars`);

  if (!captionResponse.ok || !body.length) {
    console.log(
      "\nDIAGNOSIS: the caption URL was refused or returned empty.\n" +
        "YouTube now gates timedtext behind a proof-of-origin token tied to a player\n" +
        "session, which is the usual cause of an empty 200 here.",
    );
    process.exit(1);
  }

  const parsed = JSON.parse(body);
  const cues = (parsed.events ?? []).filter((event) =>
    (event.segs ?? []).some((seg) => (seg.utf8 ?? "").trim()),
  );
  line("cues parsed", cues.length);

  if (!cues.length) {
    console.log("\nDIAGNOSIS: caption payload parsed but contains no text cues.");
    process.exit(1);
  }

  const first = cues[0].segs.map((seg) => seg.utf8 ?? "").join("").trim();
  console.log(`\nfirst cue: "${first}"`);
  console.log("\nDIAGNOSIS: transcript fetch WORKS on this machine.");
  console.log("If the MCP tool still fails, it is running a stale build — rebuild and restart.");
} catch (error) {
  console.log(`\nDIAGNOSIS: caption fetch threw: ${error.message}`);
  process.exit(1);
}
