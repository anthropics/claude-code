import type {
  AsciiFrame,
  AnimationConfig,
  AnimationSequence,
} from "./types";
import { GHOSTTY_DENSITY_RAMP } from "./themes";

/**
 * Default animation configuration following Ghostty's approach:
 * - 24fps (matching Ghostty's website animation)
 * - HTML color spans (for web playback)
 * - 8 transition frames between keyframes for smooth morphing
 */
export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  fps: 24,
  transitionFrames: 8,
  densityRamp: GHOSTTY_DENSITY_RAMP,
  loop: true,
  colorMode: "html",
};

/**
 * Build a complete animation sequence from keyframes.
 *
 * Ghostty's approach: pre-render all frames, swap via innerHTML at target FPS.
 * We extend this with morphing transitions between mermaid diagram states,
 * where characters fade in/out using the density ramp.
 */
export function buildAnimationSequence(
  keyframes: AsciiFrame[],
  config: Partial<AnimationConfig> = {}
): AnimationSequence {
  const cfg = { ...DEFAULT_ANIMATION_CONFIG, ...config };
  const allFrames: AsciiFrame[] = [];
  let frameIndex = 0;

  for (let i = 0; i < keyframes.length; i++) {
    const current = keyframes[i];
    const next = keyframes[(i + 1) % keyframes.length];

    // Add the keyframe itself (hold for a beat)
    allFrames.push({ ...current, index: frameIndex++ });

    // Generate transition frames to the next keyframe
    if (i < keyframes.length - 1 || cfg.loop) {
      const transitions = generateTransitionFrames(current, next, cfg);
      for (const frame of transitions) {
        allFrames.push({ ...frame, index: frameIndex++ });
      }
    }
  }

  const totalMs = (allFrames.length / cfg.fps) * 1000;
  return { frames: allFrames, config: cfg, totalMs };
}

/**
 * Generate morphing transition frames between two ASCII keyframes.
 *
 * Uses the Ghostty density ramp for fade effects:
 * - Characters present in source but not target: fade out (@ → % → * → · → space)
 * - Characters present in target but not source: fade in (space → · → * → % → @)
 * - Characters present in both: cross-fade through the density ramp
 */
function generateTransitionFrames(
  from: AsciiFrame,
  to: AsciiFrame,
  config: AnimationConfig
): AsciiFrame[] {
  const frames: AsciiFrame[] = [];
  const fromLines = from.content.split("\n");
  const toLines = to.content.split("\n");
  const maxRows = Math.max(fromLines.length, toLines.length);
  const maxCols = Math.max(from.cols, to.cols);

  // Pre-compute character grids (strip HTML spans for diffing)
  const fromGrid = linesToGrid(fromLines, maxRows, maxCols);
  const toGrid = linesToGrid(toLines, maxRows, maxCols);

  // Pre-compute color grids (extract span classes)
  const fromColors = linesToColorGrid(fromLines, maxRows, maxCols);
  const toColors = linesToColorGrid(toLines, maxRows, maxCols);

  const ramp = config.densityRamp;
  const steps = config.transitionFrames;

  for (let step = 1; step <= steps; step++) {
    const t = step / (steps + 1); // 0..1 progress
    const lines: string[] = [];

    for (let row = 0; row < maxRows; row++) {
      let line = "";
      for (let col = 0; col < maxCols; col++) {
        const fromChar = fromGrid[row]?.[col] ?? " ";
        const toChar = toGrid[row]?.[col] ?? " ";
        const fromColor = fromColors[row]?.[col] ?? "";
        const toColor = toColors[row]?.[col] ?? "";

        const morphed = morphChar(fromChar, toChar, t, ramp);
        const color = t < 0.5 ? fromColor : toColor;

        if (config.colorMode === "html" && color) {
          line += `<span class="${color}">${morphed}</span>`;
        } else {
          line += morphed;
        }
      }
      lines.push(line);
    }

    frames.push({
      index: 0, // Will be assigned by caller
      content: lines.join("\n"),
      cols: maxCols,
      rows: maxRows,
      era: to.era,
    });
  }

  return frames;
}

/**
 * Morph a single character through the density ramp.
 *
 * This is the core of the Ghostty-style animation:
 * - Maps each character to its position in the density ramp
 * - Interpolates between source and target positions
 * - Returns the character at the interpolated position
 */
function morphChar(
  from: string,
  to: string,
  t: number,
  ramp: string[]
): string {
  if (from === to) return from;

  const fromIdx = charToRampIndex(from, ramp);
  const toIdx = charToRampIndex(to, ramp);

  // Interpolate through the ramp
  const currentIdx = Math.round(fromIdx + (toIdx - fromIdx) * t);
  const clampedIdx = Math.max(0, Math.min(ramp.length - 1, currentIdx));

  // If target is space, fade to space
  if (to === " " && t > 0.8) return " ";
  // If source is space, keep space until we start fading in
  if (from === " " && t < 0.2) return " ";

  return ramp[clampedIdx];
}

/**
 * Map a character to its position in the density ramp.
 * Space maps to -1 (below lightest), unknown chars map to middle.
 */
function charToRampIndex(char: string, ramp: string[]): number {
  if (char === " " || char === "") return -1;
  const idx = ramp.indexOf(char);
  if (idx >= 0) return idx;
  // Map common characters to approximate density
  const densityMap: Record<string, number> = {
    ".": 0, ",": 0, "'": 0,
    "-": 1, "_": 1, "~": 1,
    ":": 2, ";": 2, "!": 2,
    "+": 4, "=": 5, "#": 6,
    "*": 6, "%": 7, "$": 8, "@": 9,
    // Box drawing characters → medium-high density
    "─": 4, "│": 4, "┌": 5, "┐": 5, "└": 5, "┘": 5,
    "├": 6, "┤": 6, "┬": 6, "┴": 6, "┼": 7,
    "▀": 7, "▄": 7, "█": 9, "▌": 7, "▐": 7,
  };
  return densityMap[char] ?? Math.floor(ramp.length / 2);
}

/**
 * Convert content lines to a 2D character grid, stripping HTML spans.
 */
function linesToGrid(
  lines: string[],
  rows: number,
  cols: number
): string[][] {
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const rawLine = lines[r] ?? "";
    const stripped = stripHtml(rawLine);
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(stripped[c] ?? " ");
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Extract color class names from HTML spans into a 2D grid.
 */
function linesToColorGrid(
  lines: string[],
  rows: number,
  cols: number
): string[][] {
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const line = lines[r] ?? "";
    const row: string[] = [];
    let col = 0;
    let currentClass = "";

    // Parse HTML spans to track color per character position
    let i = 0;
    while (i < line.length && col < cols) {
      if (line[i] === "<") {
        const spanOpen = line.slice(i).match(/^<span class="([^"]*)">/);
        if (spanOpen) {
          currentClass = spanOpen[1];
          i += spanOpen[0].length;
          continue;
        }
        const spanClose = line.slice(i).match(/^<\/span>/);
        if (spanClose) {
          currentClass = "";
          i += spanClose[0].length;
          continue;
        }
      }
      row.push(currentClass);
      col++;
      i++;
    }
    // Fill remaining columns
    while (col < cols) {
      row.push("");
      col++;
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Strip HTML tags from a string (for character-level diffing).
 */
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

// ── Luminance mapping (Ghostty's CIE 1931 approach) ──

/**
 * Convert an RGB pixel to a density-ramp character using Ghostty's
 * CIE 1931 relative luminance formula (ITU-R BT.709).
 */
export function rgbToAsciiChar(
  r: number,
  g: number,
  b: number,
  ramp: string[] = GHOSTTY_DENSITY_RAMP
): string {
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const scaled = Math.round((luminance / 255) * (ramp.length - 1));
  return ramp[Math.max(0, Math.min(ramp.length - 1, scaled))];
}

/**
 * Compute the Manhattan color distance (Ghostty's approach).
 */
export function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

// ── Frame generation from text content ──

/**
 * Create a keyframe from raw ASCII text, with optional era tag and color class.
 */
export function textToFrame(
  text: string,
  era?: string,
  colorClass?: string
): AsciiFrame {
  const lines = text.split("\n");
  const cols = Math.max(...lines.map((l) => stripHtml(l).length));
  const rows = lines.length;

  let content = text;
  if (colorClass) {
    content = lines
      .map((line) => `<span class="${colorClass}">${line}</span>`)
      .join("\n");
  }

  return { index: 0, content, cols, rows, era };
}

/**
 * Create a title card frame (centered text with border).
 */
export function titleFrame(
  title: string,
  subtitle: string,
  width: number = 80,
  colorClass?: string
): AsciiFrame {
  const lines: string[] = [];
  const border = "═".repeat(width);
  const pad = (s: string) => {
    const left = Math.floor((width - s.length) / 2);
    return " ".repeat(Math.max(0, left)) + s;
  };

  lines.push(`╔${border}╗`);
  lines.push(`║${" ".repeat(width)}║`);
  lines.push(`║${pad(title).padEnd(width)}║`);
  lines.push(`║${pad(subtitle).padEnd(width)}║`);
  lines.push(`║${" ".repeat(width)}║`);
  lines.push(`╚${border}╝`);

  return textToFrame(lines.join("\n"), undefined, colorClass);
}
