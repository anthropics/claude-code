import type { VizTheme } from "./types";

/**
 * Ghostty-inspired dark theme — the primary theme for ASCII animation.
 * Derived from Ghostty's website palette: deep dark bg, blue accent,
 * warm white foreground, with era colors matching the subagents timeline.
 */
export const ghosttyDark: VizTheme = {
  name: "ghostty-dark",
  bg: "#0d1117",
  fg: "#c9d1d9",
  accent: "#6e40c9",
  muted: "#484f58",
  surface: "#161b22",
  border: "#30363d",
  eraColors: {
    foundation: "#58a6ff",
    customization: "#3fb950",
    enhancement: "#d29922",
    teams: "#f85149",
  },
  emptyChar: " ",
  fontFamily:
    '"Berkeley Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
};

/**
 * Vercel-inspired light theme for SVG diagrams.
 */
export const vercelLight: VizTheme = {
  name: "vercel-light",
  bg: "#ffffff",
  fg: "#171717",
  accent: "#0070f3",
  muted: "#666666",
  surface: "#fafafa",
  border: "#eaeaea",
  eraColors: {
    foundation: "#0070f3",
    customization: "#17b169",
    enhancement: "#f5a623",
    teams: "#ee0000",
  },
  emptyChar: " ",
  fontFamily: '"Geist Mono", "Inter", system-ui, sans-serif',
};

/**
 * Tokyo Night theme — popular with developers, great contrast for ASCII art.
 */
export const tokyoNight: VizTheme = {
  name: "tokyo-night",
  bg: "#1a1b26",
  fg: "#a9b1d6",
  accent: "#7aa2f7",
  muted: "#565f89",
  surface: "#24283b",
  border: "#414868",
  eraColors: {
    foundation: "#7aa2f7",
    customization: "#9ece6a",
    enhancement: "#e0af68",
    teams: "#f7768e",
  },
  emptyChar: " ",
  fontFamily:
    '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
};

export const THEMES: Record<string, VizTheme> = {
  "ghostty-dark": ghosttyDark,
  "vercel-light": vercelLight,
  "tokyo-night": tokyoNight,
};

export const DEFAULT_THEME = ghosttyDark;

/**
 * Convert a VizTheme to beautiful-mermaid RenderOptions color subset.
 */
export function toMermaidColors(theme: VizTheme) {
  return {
    bg: theme.bg,
    fg: theme.fg,
    accent: theme.accent,
    muted: theme.muted,
    surface: theme.surface,
    border: theme.border,
  };
}

/**
 * Ghostty character density ramp — maps luminance 0-9 to visual weight.
 * Identical to the ramp used in ghostty.org's video-to-terminal pipeline.
 */
export const GHOSTTY_DENSITY_RAMP = [
  "·", // 0 — lightest
  "~", // 1
  "o", // 2
  "x", // 3
  "+", // 4
  "=", // 5
  "*", // 6
  "%", // 7
  "$", // 8
  "@", // 9 — heaviest
];

/**
 * Alternative ASCII-only density ramp (no unicode).
 */
export const ASCII_DENSITY_RAMP = [
  ".", // 0
  "-", // 1
  ":", // 2
  "=", // 3
  "+", // 4
  "*", // 5
  "#", // 6
  "%", // 7
  "$", // 8
  "@", // 9
];
