import type { TranscriptCue } from "../types.js";

/**
 * Parse an SRT timecode into seconds.
 *
 * SRT uses a comma before the milliseconds ("00:01:02,500"); WebVTT uses a dot.
 * Both are accepted so the caller can request either `tfmt`.
 */
function parseTimecode(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(value.trim());
  if (!match) return null;
  const [, h, m, s, ms] = match;
  return (
    Number(h) * 3600 + Number(m) * 60 + Number(s) + Number((ms ?? "0").padEnd(3, "0")) / 1000
  );
}

/**
 * Parse SRT or WebVTT caption text into cues.
 *
 * Blocks are separated by blank lines. A block is an optional numeric index,
 * a `start --> end` line, then one or more text lines. Anything that does not
 * match — WEBVTT headers, NOTE blocks, styling cues — is skipped rather than
 * failing the parse, because YouTube's VTT output carries all three.
 */
export function parseCaptions(text: string): TranscriptCue[] {
  const cues: TranscriptCue[] = [];
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim().length > 0);
    if (!lines.length) continue;

    const arrowIndex = lines.findIndex((line) => line.includes("-->"));
    if (arrowIndex === -1) continue;

    const timing = lines[arrowIndex] as string;
    const [rawStart, rawEnd] = timing.split("-->");
    if (!rawStart || !rawEnd) continue;

    const start = parseTimecode(rawStart);
    // VTT can append cue settings after the end time ("00:00:02.500 align:start").
    const end = parseTimecode((rawEnd.trim().split(/\s+/)[0] ?? ""));
    if (start === null || end === null) continue;

    const body = lines
      .slice(arrowIndex + 1)
      .join(" ")
      // Strip VTT inline tags such as <c.colorE5E5E5> and <00:00:01.000>.
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!body) continue;

    cues.push({ start, duration: Math.max(0, end - start), text: body });
  }

  return cues;
}
