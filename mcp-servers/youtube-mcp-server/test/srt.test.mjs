#!/usr/bin/env node
/**
 * Unit tests for the caption parser.
 *
 *   npm run build && node test/srt.test.mjs
 *
 * The download itself needs OAuth credentials for an account that owns a video,
 * so it cannot be exercised here. Parsing is the part that can be, and it is
 * where format surprises actually bite — so it is covered thoroughly.
 */

import { parseCaptions } from "../dist/services/srt.js";

// A closed stdout is normal when piping to `head` or `grep -m`. Without this,
// Node raises an unhandled EPIPE that looks like a test failure.
process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(0);
});

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "ok   " : "FAIL "} ${label}`);
  if (!ok) {
    console.log(`      expected ${JSON.stringify(expected)}`);
    console.log(`      actual   ${JSON.stringify(actual)}`);
  }
}

// Plain SRT, the format the tool requests via tfmt=srt.
check(
  "parses basic SRT",
  parseCaptions(
    "1\n00:00:00,000 --> 00:00:02,500\nHello world\n\n2\n00:00:02,500 --> 00:00:05,000\nSecond cue\n",
  ),
  [
    { start: 0, duration: 2.5, text: "Hello world" },
    { start: 2.5, duration: 2.5, text: "Second cue" },
  ],
);

check(
  "joins multi-line cue text",
  parseCaptions("1\n00:00:01,000 --> 00:00:03,000\nfirst line\nsecond line\n"),
  [{ start: 1, duration: 2, text: "first line second line" }],
);

check(
  "handles hours",
  parseCaptions("1\n01:02:03,250 --> 01:02:04,750\nlate cue\n"),
  [{ start: 3723.25, duration: 1.5, text: "late cue" }],
);

check(
  "handles CRLF line endings",
  parseCaptions("1\r\n00:00:00,000 --> 00:00:01,000\r\nwindows\r\n"),
  [{ start: 0, duration: 1, text: "windows" }],
);

check(
  "accepts a missing index line",
  parseCaptions("00:00:00,000 --> 00:00:01,000\nno index\n"),
  [{ start: 0, duration: 1, text: "no index" }],
);

// WebVTT, in case a caller switches tfmt — dots instead of commas, a header,
// cue settings after the end time, and inline styling tags.
check(
  "parses WebVTT with header and cue settings",
  parseCaptions(
    "WEBVTT\n\n00:00:00.000 --> 00:00:02.000 align:start position:0%\n<c.colorE5E5E5>styled</c> text\n",
  ),
  [{ start: 0, duration: 2, text: "styled text" }],
);

check(
  "skips NOTE blocks",
  parseCaptions("WEBVTT\n\nNOTE this is a comment\n\n00:00:00.000 --> 00:00:01.000\nreal cue\n"),
  [{ start: 0, duration: 1, text: "real cue" }],
);

// Degenerate inputs must return [] rather than throwing — the tool turns an
// empty result into a specific message, and a crash would lose that.
check("empty string yields no cues", parseCaptions(""), []);
check("whitespace yields no cues", parseCaptions("\n\n   \n\n"), []);
check("text without timings yields no cues", parseCaptions("just some prose\nwith lines"), []);
check(
  "malformed timecode is skipped, valid cue kept",
  parseCaptions("1\nnot-a-time --> also-not\nskipped\n\n2\n00:00:01,000 --> 00:00:02,000\nkept\n"),
  [{ start: 1, duration: 1, text: "kept" }],
);
check(
  "cue with no text is dropped",
  parseCaptions("1\n00:00:01,000 --> 00:00:02,000\n\n\n2\n00:00:02,000 --> 00:00:03,000\nreal\n"),
  [{ start: 2, duration: 1, text: "real" }],
);
check(
  "end before start clamps duration to zero rather than going negative",
  parseCaptions("1\n00:00:05,000 --> 00:00:02,000\nbackwards\n"),
  [{ start: 5, duration: 0, text: "backwards" }],
);

check(
  "collapses runs of whitespace",
  parseCaptions("1\n00:00:00,000 --> 00:00:01,000\nlots     of\t\tspace\n"),
  [{ start: 0, duration: 1, text: "lots of space" }],
);

console.log(`\n${failures ? `${failures} failed` : "all passed"}`);
process.exit(failures ? 1 : 0);
