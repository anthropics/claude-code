#!/usr/bin/env node
/**
 * Unit tests for the video row normalizer.
 *
 *   npm run build && node test/video-row.test.mjs
 *
 * toVideoRow has to reconcile three endpoints that each put the video id
 * somewhere different. Getting it wrong is not loud — no throw, no empty
 * result, just rows carrying a plausible-looking id that resolves to nothing.
 * These cases pin down all three shapes so a regression shows up here instead
 * of as dead watch URLs.
 */

import { toVideoRow } from "../dist/services/render.js";

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

// videos.list — the id is a bare string and contentDetails holds the duration.
check(
  "videos.list: bare string id",
  toVideoRow({
    id: "Vz4AQDjmFyI",
    snippet: { title: "Details" },
    contentDetails: { duration: "PT21S" },
  }).id,
  "Vz4AQDjmFyI",
);

check(
  "videos.list: duration survives",
  toVideoRow({ id: "Vz4AQDjmFyI", contentDetails: { duration: "PT21S" } }).duration,
  "PT21S",
);

// search.list — the id is an object and contentDetails is absent entirely.
check(
  "search.list: id.videoId",
  toVideoRow({ id: { videoId: "9KefD3SlUa8" }, snippet: { title: "Result" } }).id,
  "9KefD3SlUa8",
);

// playlistItems.list — BOTH ids are populated. item.id is the playlist row,
// which is base64("<playlistId>.<videoId>"); only contentDetails.videoId is
// the real video. This is the case the ??-chain used to get backwards.
check(
  "playlistItems.list: prefers contentDetails.videoId over the playlist row id",
  toVideoRow({
    id: "VVVPU2gwaVFPUlA1RUxUNlNLRTdXeUlnLlZ6NEFRRGptRnlJ",
    snippet: { title: "Upload" },
    contentDetails: { videoId: "Vz4AQDjmFyI" },
  }).id,
  "Vz4AQDjmFyI",
);

check(
  "playlistItems.list: builds a working watch URL",
  toVideoRow({
    id: "VVVPU2gwaVFPUlA1RUxUNlNLRTdXeUlnLjlLZWZEM1NsVWE4",
    contentDetails: { videoId: "9KefD3SlUa8" },
  }).url,
  "https://www.youtube.com/watch?v=9KefD3SlUa8",
);

// The statistics merge in youtube_list_channel_videos keys off this id, so a
// wrong id silently drops every stat. Guard the shape the merge relies on.
check(
  "playlistItems id is the 11-character form videos.list can be keyed by",
  toVideoRow({
    id: "VVVPU2gwaVFPUlA1RUxUNlNLRTdXeUlnLnk0YTUtb2dWaUtJ",
    contentDetails: { videoId: "y4a5-ogViKI" },
  }).id.length,
  11,
);

// Degenerate inputs must yield "" rather than throwing — callers filter on
// falsy ids before spending a quota unit on videos.list.
check("missing id yields empty string", toVideoRow({ snippet: { title: "No id" } }).id, "");
check("empty item yields empty string", toVideoRow({}).id, "");
check(
  "id object without videoId yields empty string",
  toVideoRow({ id: { channelId: "UCOSh0iQORP5ELT6SKE7WyIg" } }).id,
  "",
);

// Field mapping, so a rename in the API surface fails loudly.
check(
  "maps snippet and statistics onto the row",
  toVideoRow({
    id: "hSUfM1d_m28",
    snippet: {
      title: "Artificial",
      channelTitle: "Batu Hunca",
      channelId: "UCOSh0iQORP5ELT6SKE7WyIg",
      publishedAt: "2006-09-27T10:50:20Z",
      description: "Low quality match",
    },
    statistics: { viewCount: "100", likeCount: "5", commentCount: "2" },
  }),
  {
    id: "hSUfM1d_m28",
    title: "Artificial",
    channel_title: "Batu Hunca",
    channel_id: "UCOSh0iQORP5ELT6SKE7WyIg",
    published_at: "2006-09-27T10:50:20Z",
    description: "Low quality match",
    view_count: "100",
    like_count: "5",
    comment_count: "2",
    url: "https://www.youtube.com/watch?v=hSUfM1d_m28",
  },
);

check("falls back to a placeholder title", toVideoRow({ id: "hSUfM1d_m28" }).title, "(untitled)");

console.log(`\n${failures ? `${failures} failed` : "all passed"}`);
process.exit(failures ? 1 : 0);
