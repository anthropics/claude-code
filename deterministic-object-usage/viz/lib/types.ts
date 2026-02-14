// ── Core domain types for the deterministic visualization pipeline ──

export type ChangeType = "added" | "fixed" | "changed" | "breaking";

export interface ChangeEntry {
  type: ChangeType;
  text: string;
  /** Raw identifiers found in the entry (e.g., `subagentStop`, `maxTurns`) */
  identifiers: string[];
}

export interface VersionBlock {
  version: string;
  date?: string;
  changes: ChangeEntry[];
}

export interface Era {
  id: string;
  label: string;
  color: string;
  /** CSS accent for the era badge/dot */
  accent: string;
  versions: string[];
}

export interface FeatureConfig {
  name: string;
  keywords: string[];
  /** Secondary keywords that require additional context to match */
  contextKeywords?: string[];
  /** Strings that should exclude an entry even if keywords match */
  excludePatterns?: string[];
  eras: Era[];
}

export interface ParsedFeature {
  config: FeatureConfig;
  versions: VersionBlock[];
  /** Mermaid source for the architecture diagram */
  architectureMermaid: string;
  /** Mermaid source for the sequence/interaction diagram */
  sequenceMermaid: string;
  /** Per-era mermaid diagrams for animated transitions */
  eraMermaids: Map<string, string>;
}

// ── ASCII Animation types (Ghostty-style) ──

export interface AsciiFrame {
  /** Frame index (0-based) */
  index: number;
  /** The ASCII art content (may contain HTML spans for color) */
  content: string;
  /** Width in columns */
  cols: number;
  /** Height in rows */
  rows: number;
  /** Optional era ID this frame belongs to */
  era?: string;
}

export interface AnimationConfig {
  /** Target frames per second (default: 24) */
  fps: number;
  /** Total animation duration in ms (overrides fps-based timing if set) */
  duration?: number;
  /** Number of transition frames between keyframes */
  transitionFrames: number;
  /** Character density ramp from lightest to heaviest */
  densityRamp: string[];
  /** Whether to loop the animation */
  loop: boolean;
  /** Color mode for output */
  colorMode: "ansi" | "html" | "none";
}

export interface AnimationSequence {
  frames: AsciiFrame[];
  config: AnimationConfig;
  /** Total runtime in ms */
  totalMs: number;
}

// ── Mermaid generation types ──

export type DiagramType = "flowchart" | "sequence" | "state" | "class" | "er";

export interface DiagramSpec {
  type: DiagramType;
  title: string;
  source: string;
  era?: string;
}

// ── Theme types ──

export interface VizTheme {
  name: string;
  bg: string;
  fg: string;
  accent: string;
  muted: string;
  surface: string;
  border: string;
  /** Era-specific accent overrides */
  eraColors: Record<string, string>;
  /** Character used for empty space in ASCII mode */
  emptyChar: string;
  /** CSS font-family for the terminal view */
  fontFamily: string;
}
