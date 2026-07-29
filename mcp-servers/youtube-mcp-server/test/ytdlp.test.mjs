#!/usr/bin/env node
/**
 * Unit tests for the yt-dlp transcript path.
 *
 *   npm run build && node test/ytdlp.test.mjs
 *
 * Spawning yt-dlp needs the network and a JS runtime, so the subprocess itself
 * is not exercised here. What is covered is the part that breaks silently: the
 * json3 parser, and the contract planAttempts() has to satisfy.
 *
 * The fixtures below are trimmed from real yt-dlp output for rKV5JcALQoQ. The
 * two track kinds do NOT share a shape, which is the whole reason these tests
 * exist:
 *   - uploaded track: one segment per event, no empty events at all
 *   - ASR track:      a leading window-definition event with no segs, ~150
 *                     empty-text events (rolling captions), and word-level
 *                     segments carrying tOffsetMs that must be joined
 */

import { parseJson3, planAttempts } from "../dist/services/ytdlp.js";

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

function checkThat(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok   " : "FAIL "} ${label}`);
  if (!ok && detail !== undefined) console.log(`      ${detail}`);
}

// --- parseJson3: uploaded track -------------------------------------------

check(
  "parses an uploaded track",
  parseJson3(
    JSON.stringify({
      wireMagic: "pb3",
      events: [
        { tStartMs: 292, dDurationMs: 2000, segs: [{ utf8: "Think of the mind like an ocean." }] },
        { tStartMs: 2292, dDurationMs: 1500, segs: [{ utf8: "Up on the surface are our thoughts." }] },
      ],
    }),
  ),
  [
    { start: 0.292, duration: 2, text: "Think of the mind like an ocean." },
    { start: 2.292, duration: 1.5, text: "Up on the surface are our thoughts." },
  ],
);

// --- parseJson3: ASR track ------------------------------------------------

// Word-level segments must be joined into one cue. tOffsetMs is per-word timing
// and is deliberately ignored — cue granularity stays at the event level.
check(
  "joins word-level ASR segments",
  parseJson3(
    JSON.stringify({
      events: [
        {
          tStartMs: 800,
          dDurationMs: 4880,
          wWinId: 1,
          segs: [
            { utf8: "Think" },
            { utf8: " of", tOffsetMs: 200 },
            { utf8: " the", tOffsetMs: 320 },
            { utf8: " ocean.", tOffsetMs: 440 },
          ],
        },
      ],
    }),
  ),
  [{ start: 0.8, duration: 4.88, text: "Think of the ocean." }],
);

// The leading window-definition event has no segs at all.
check(
  "drops events with no segs",
  parseJson3(
    JSON.stringify({
      events: [
        { tStartMs: 0, dDurationMs: 323680, id: 1, wpWinPosId: 1, wsWinStyleId: 1 },
        { tStartMs: 800, dDurationMs: 1000, segs: [{ utf8: "Real text" }] },
      ],
    }),
  ),
  [{ start: 0.8, duration: 1, text: "Real text" }],
);

// Rolling captions emit blank events between phrases — about half of an ASR
// track. These must not become empty cues.
check(
  "drops empty-text events",
  parseJson3(
    JSON.stringify({
      events: [
        { tStartMs: 100, dDurationMs: 10, segs: [{ utf8: "\n" }] },
        { tStartMs: 200, dDurationMs: 10, segs: [{ utf8: "" }] },
        { tStartMs: 300, dDurationMs: 10, segs: [{ utf8: "   " }] },
        { tStartMs: 400, dDurationMs: 1000, segs: [{ utf8: "Kept" }] },
      ],
    }),
  ),
  [{ start: 0.4, duration: 1, text: "Kept" }],
);

check(
  "collapses internal whitespace and newlines",
  parseJson3(
    JSON.stringify({
      events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "two\nlines   spaced" }] }],
    }),
  ),
  [{ start: 0, duration: 1, text: "two lines spaced" }],
);

check(
  "treats missing timings as zero",
  parseJson3(JSON.stringify({ events: [{ segs: [{ utf8: "No timings" }] }] })),
  [{ start: 0, duration: 0, text: "No timings" }],
);

check("handles an empty event list", parseJson3(JSON.stringify({ events: [] })), []);
check("handles a payload with no events key", parseJson3("{}"), []);

// --- parseJson3: malformed input ------------------------------------------

let threw = null;
try {
  parseJson3("not json at all");
} catch (error) {
  threw = error;
}
checkThat(
  "throws YtdlpError on invalid JSON",
  threw !== null && threw.name === "YtdlpError" && threw.kind === "failed",
  `got ${threw ? `${threw.name}/${threw.kind}` : "no error"}`,
);

// --- planAttempts: contract ----------------------------------------------
//
// The ordering policy is a judgement call and is intentionally not asserted
// here. What IS asserted is the shape fetchTranscript() depends on, plus one
// quality invariant: an uploaded track must be tried before falling back to
// anything auto-generated, since ASR mis-hears names and technical terms.

for (const language of ["en", "tr", undefined]) {
  const label = language ?? "(no preference)";
  let attempts = null;
  let error = null;
  try {
    attempts = planAttempts(language);
  } catch (e) {
    error = e;
  }

  if (error) {
    checkThat(`planAttempts(${label}) returns attempts`, false, `threw: ${error.message}`);
    continue;
  }

  checkThat(
    `planAttempts(${label}) returns a non-empty array`,
    Array.isArray(attempts) && attempts.length > 0,
    `got ${JSON.stringify(attempts)}`,
  );

  const shapeOk =
    Array.isArray(attempts) &&
    attempts.every(
      (a) =>
        a &&
        Array.isArray(a.langs) &&
        a.langs.length > 0 &&
        a.langs.every((l) => typeof l === "string" && l.length > 0) &&
        typeof a.auto === "boolean" &&
        typeof a.label === "string" &&
        a.label.length > 0,
    );
  checkThat(
    `planAttempts(${label}) entries have langs/auto/label`,
    shapeOk,
    `got ${JSON.stringify(attempts)}`,
  );

  if (Array.isArray(attempts) && attempts.length && shapeOk) {
    checkThat(
      `planAttempts(${label}) tries an uploaded track before an auto one`,
      attempts[0].auto === false,
      `first attempt was auto=${attempts[0].auto}`,
    );
  }
}

// A requested language must actually appear somewhere in the plan, otherwise
// the parameter is silently ignored.
try {
  const trPlan = planAttempts("tr");
  checkThat(
    "planAttempts('tr') mentions tr somewhere",
    trPlan.some((a) => a.langs.includes("tr")),
    `got ${JSON.stringify(trPlan.map((a) => a.langs))}`,
  );
} catch (error) {
  checkThat("planAttempts('tr') mentions tr somewhere", false, `threw: ${error.message}`);
}

console.log(failures ? `\n${failures} failure(s)` : "\nall passed");
process.exit(failures ? 1 : 0);
