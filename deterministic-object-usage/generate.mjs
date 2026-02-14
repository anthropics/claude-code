#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// generate.mjs — CHANGELOG Feature Domain → Animated ASCII + SVG Visualization
//
// Pipeline:
//   1. Define mermaid diagram from feature data
//   2. Render SVG via @vercel/beautiful-mermaid (animated, themed)
//   3. Render ASCII via renderMermaidAscii
//   4. Generate Ghostty-style progressive-reveal animation frames
//   5. Emit self-contained HTML with dual-mode viewer
//
// Usage:
//   node generate.mjs                          # defaults to 003 agent-tools
//   node generate.mjs --output my-file.html
// ─────────────────────────────────────────────────────────────────────────────
import { renderMermaid, renderMermaidAscii, THEMES } from "@vercel/beautiful-mermaid";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const outputFlag = args.indexOf("--output");
const outputFile =
  outputFlag !== -1 && args[outputFlag + 1]
    ? args[outputFlag + 1]
    : "003-claude-agent-tools.html";

// ─── Feature data: Agent Tools & Skills ──────────────────────────────────────
// Mermaid diagram representing the interaction graph
const INTERACTION_GRAPH = `graph TD
    H["<b>Hooks</b><br/><i>v1.0.38</i>"]
    SK["<b>Skills</b><br/><i>v2.0.20</i>"]
    MCP["<b>MCP Servers</b><br/><i>v1.0.4</i>"]
    SA["<b>Subagents</b><br/><i>v1.0.60</i>"]
    TT["<b>Task Tool</b><br/><i>v2.1.16</i>"]
    PL["<b>Plugins</b><br/><i>v2.0.12</i>"]
    AT["<b>Agent Tools</b><br/><i>v1.0.0</i>"]

    H -->|frontmatter hooks| SK
    H -->|SubagentStart/Stop| SA
    H -->|plugin hooks| PL
    H -->|lifecycle| TT
    H -->|config| MCP
    SK -->|context:fork| SA
    SK -->|plugin skills| PL
    SA -->|manages| TT
    SA -->|background| AT
    MCP -->|tool access| SA
    MCP -->|plugin MCPs| PL
    TT -->|task mgmt| AT`;

// Simplified version for ASCII (no HTML in labels)
const INTERACTION_GRAPH_ASCII = `graph TD
    H[Hooks v1.0.38]
    SK[Skills v2.0.20]
    MCP[MCP Servers v1.0.4]
    SA[Subagents v1.0.60]
    TT[Task Tool v2.1.16]
    PL[Plugins v2.0.12]
    AT[Agent Tools v1.0.0]

    H -->|frontmatter| SK
    H -->|SubagentStart| SA
    H -->|plugin hooks| PL
    H -->|lifecycle| TT
    H -->|config| MCP
    SK -->|fork| SA
    SK -->|plugin| PL
    SA -->|manages| TT
    SA -->|background| AT
    MCP -->|access| SA
    MCP -->|plugin| PL
    TT -->|mgmt| AT`;

// Timeline mermaid for the feature evolution
const TIMELINE_GRAPH = `graph LR
    V1["1.0.4<br/>MCP"] --> V2["1.0.38<br/>Hooks"]
    V2 --> V3["1.0.60<br/>Subagents"]
    V3 --> V4["1.0.123<br/>SlashCmd"]
    V4 --> V5["2.0.12<br/>Plugins"]
    V5 --> V6["2.0.20<br/>Skills"]
    V6 --> V7["2.1.0<br/>Hot-reload"]
    V7 --> V8["2.1.16<br/>Task Tool"]
    V8 --> V9["2.1.32<br/>Agent Teams"]`;

const TIMELINE_GRAPH_ASCII = `graph LR
    V1[1.0.4 MCP] --> V2[1.0.38 Hooks]
    V2 --> V3[1.0.60 Subagents]
    V3 --> V4[1.0.123 SlashCmd]
    V4 --> V5[2.0.12 Plugins]
    V5 --> V6[2.0.20 Skills]
    V6 --> V7[2.1.0 Hot-reload]
    V7 --> V8[2.1.16 Task Tool]
    V8 --> V9[2.1.32 Teams]`;

// ─── Category colors ─────────────────────────────────────────────────────────
const COLORS = {
  hooks:        { hex: "#f0883e", label: "Hooks" },
  skills:       { hex: "#a371f7", label: "Skills" },
  mcp:          { hex: "#58a6ff", label: "MCP" },
  subagents:    { hex: "#3fb950", label: "Subagents" },
  task:         { hex: "#d2a8ff", label: "Task Tool" },
  "agent-tools":{ hex: "#ff7b72", label: "Agent Tools" },
  plugins:      { hex: "#f778ba", label: "Plugins" },
};

// ─── Ghostty-style character density ramp ────────────────────────────────────
// 10 characters from lightest (0) to heaviest (9)
const DENSITY_CHARS = ["·", "~", "o", "x", "+", "=", "*", "%", "$", "@"];

// ─── Color map: which words in the ASCII get which color ─────────────────────
const WORD_COLORS = {
  Hooks:      COLORS.hooks.hex,
  Skills:     COLORS.skills.hex,
  MCP:        COLORS.mcp.hex,
  Servers:    COLORS.mcp.hex,
  Subagents:  COLORS.subagents.hex,
  Task:       COLORS.task.hex,
  Tool:       COLORS.task.hex,
  Plugins:    COLORS.plugins.hex,
  Agent:      COLORS["agent-tools"].hex,
  Tools:      COLORS["agent-tools"].hex,
  // version markers
  "v1.0.38":  COLORS.hooks.hex,
  "v2.0.20":  COLORS.skills.hex,
  "v1.0.4":   COLORS.mcp.hex,
  "v1.0.60":  COLORS.subagents.hex,
  "v2.1.16":  COLORS.task.hex,
  "v2.0.12":  COLORS.plugins.hex,
  "v1.0.0":   COLORS["agent-tools"].hex,
  // timeline versions
  "1.0.4":    COLORS.mcp.hex,
  "1.0.38":   COLORS.hooks.hex,
  "1.0.60":   COLORS.subagents.hex,
  "1.0.123":  COLORS["agent-tools"].hex,
  "2.0.12":   COLORS.plugins.hex,
  "2.0.20":   COLORS.skills.hex,
  "2.1.0":    COLORS.skills.hex,
  "2.1.16":   COLORS.task.hex,
  "2.1.32":   COLORS.subagents.hex,
  // edge labels
  frontmatter: COLORS.hooks.hex,
  SubagentStart: COLORS.subagents.hex,
  lifecycle:  COLORS.task.hex,
  config:     COLORS.mcp.hex,
  fork:       COLORS.subagents.hex,
  plugin:     COLORS.plugins.hex,
  manages:    COLORS.task.hex,
  background: COLORS["agent-tools"].hex,
  access:     COLORS.mcp.hex,
  mgmt:       COLORS.task.hex,
  "Hot-reload": COLORS.skills.hex,
  SlashCmd:   COLORS["agent-tools"].hex,
  Teams:      COLORS.subagents.hex,
};

// ─── Colorize ASCII art ──────────────────────────────────────────────────────
// Wraps recognized words in <span style="color:..."> tags
function colorizeAscii(ascii) {
  let html = ascii
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Sort keywords longest-first to avoid partial matches
  const keywords = Object.keys(WORD_COLORS).sort((a, b) => b.length - a.length);
  for (const kw of keywords) {
    const color = WORD_COLORS[kw];
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Word-boundary-ish match (allow adjacent box-drawing chars)
    html = html.replace(
      new RegExp(`(${escaped})`, "g"),
      `<span style="color:${color}">$1</span>`
    );
  }
  return html;
}

// ─── Generate progressive-reveal animation frames ────────────────────────────
// Inspired by Ghostty: each frame reveals more characters, rank by rank
function generateFrames(asciiLines, totalFrames = 60) {
  const lines = asciiLines.split("\n");
  const height = lines.length;
  const width = Math.max(...lines.map((l) => l.length));

  // Pad all lines to same width
  const padded = lines.map((l) => l.padEnd(width));

  // Build a "character presence" grid — which chars are non-space
  const charGrid = padded.map((line) =>
    [...line].map((ch) => (ch !== " " ? 1 : 0))
  );

  // Calculate total non-space characters
  const totalChars = charGrid.flat().reduce((a, b) => a + b, 0);
  const charsPerFrame = Math.max(1, Math.ceil(totalChars / (totalFrames - 10)));

  // Determine reveal order: top-to-bottom, left-to-right (rank-based)
  const revealOrder = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (charGrid[y][x]) {
        revealOrder.push({ x, y });
      }
    }
  }

  const frames = [];

  // Phase 1: Progressive reveal (frames 0 to totalFrames-10)
  for (let f = 0; f <= totalFrames - 10; f++) {
    const charsToShow = Math.min(f * charsPerFrame, revealOrder.length);
    const revealed = new Set();
    for (let i = 0; i < charsToShow; i++) {
      const { x, y } = revealOrder[i];
      revealed.add(`${y},${x}`);
    }

    const frameLines = [];
    for (let y = 0; y < height; y++) {
      let line = "";
      for (let x = 0; x < width; x++) {
        if (revealed.has(`${y},${x}`)) {
          line += padded[y][x];
        } else if (charGrid[y][x] && charsToShow > 0) {
          // "Materializing" effect: show a random density char for chars
          // that are about to appear (within the next few frames)
          const nextRevealIdx = revealOrder.findIndex(
            (p) => p.x === x && p.y === y
          );
          if (
            nextRevealIdx !== -1 &&
            nextRevealIdx < charsToShow + charsPerFrame * 3
          ) {
            const densityIdx = Math.floor(Math.random() * 4);
            line += DENSITY_CHARS[densityIdx];
          } else {
            line += " ";
          }
        } else {
          line += " ";
        }
      }
      frameLines.push(line);
    }
    frames.push(frameLines.join("\n"));
  }

  // Phase 2: Full diagram hold (frames totalFrames-9 to totalFrames)
  const fullAscii = padded.join("\n");
  for (let f = 0; f < 10; f++) {
    frames.push(fullAscii);
  }

  return frames;
}

// ─── Ghostty-style density shimmer effect ────────────────────────────────────
// Creates frames where box-drawing characters shimmer with density chars
function generateShimmerFrames(asciiLines, numFrames = 30) {
  const lines = asciiLines.split("\n");
  const height = lines.length;
  const width = Math.max(...lines.map((l) => l.length));
  const padded = lines.map((l) => l.padEnd(width));

  const boxChars = new Set("┌┐└┘├┤┬┴┼─│▼▶◀▲►◄△▽▷◁");
  const frames = [];

  for (let f = 0; f < numFrames; f++) {
    const phase = (f / numFrames) * Math.PI * 2;
    const frameLines = [];

    for (let y = 0; y < height; y++) {
      let line = "";
      for (let x = 0; x < width; x++) {
        const ch = padded[y][x];
        if (boxChars.has(ch)) {
          // Shimmer: cycle through density chars based on position + phase
          const wave = Math.sin(phase + x * 0.3 + y * 0.5);
          const idx = Math.floor(((wave + 1) / 2) * (DENSITY_CHARS.length - 1));
          line += DENSITY_CHARS[idx];
        } else {
          line += ch;
        }
      }
      frameLines.push(line);
    }
    frames.push(frameLines.join("\n"));
  }

  return frames;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Rendering mermaid diagrams...");

  // 1. Render SVGs (for the static mode)
  const svgInteraction = await renderMermaid(INTERACTION_GRAPH, {
    ...THEMES["vercel-dark"],
    animate: true,
  });

  const svgTimeline = await renderMermaid(TIMELINE_GRAPH, {
    ...THEMES["vercel-dark"],
    animate: true,
  });

  // 2. Render ASCII
  const asciiInteraction = renderMermaidAscii(INTERACTION_GRAPH_ASCII, {
    useAscii: false, // use Unicode box-drawing
  });

  const asciiTimeline = renderMermaidAscii(TIMELINE_GRAPH_ASCII, {
    useAscii: false,
  });

  console.log("Interaction graph ASCII:");
  console.log(asciiInteraction);
  console.log("\nTimeline ASCII:");
  console.log(asciiTimeline);

  // 3. Generate animation frames
  console.log("\nGenerating animation frames...");

  const revealFramesInteraction = generateFrames(asciiInteraction, 50);
  const shimmerFramesInteraction = generateShimmerFrames(asciiInteraction, 20);
  const revealFramesTimeline = generateFrames(asciiTimeline, 40);
  const shimmerFramesTimeline = generateShimmerFrames(asciiTimeline, 20);

  // 4. Colorize the final ASCII for the hold frame
  const colorizedInteraction = colorizeAscii(asciiInteraction);
  const colorizedTimeline = colorizeAscii(asciiTimeline);

  // 5. Build HTML
  console.log("Building HTML...");
  const html = buildHTML({
    svgInteraction,
    svgTimeline,
    colorizedInteraction,
    colorizedTimeline,
    revealFramesInteraction: revealFramesInteraction.map(colorizeAscii),
    shimmerFramesInteraction: shimmerFramesInteraction.map(colorizeAscii),
    revealFramesTimeline: revealFramesTimeline.map(colorizeAscii),
    shimmerFramesTimeline: shimmerFramesTimeline.map(colorizeAscii),
  });

  const outPath = resolve(__dirname, outputFile);
  writeFileSync(outPath, html, "utf-8");
  console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
}

// ─── HTML Template ───────────────────────────────────────────────────────────
function buildHTML({
  svgInteraction,
  svgTimeline,
  colorizedInteraction,
  colorizedTimeline,
  revealFramesInteraction,
  shimmerFramesInteraction,
  revealFramesTimeline,
  shimmerFramesTimeline,
}) {
  // Escape for embedding in JS template literal
  const escapeForJS = (s) =>
    JSON.stringify(s);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Code — Agent Tools &amp; Skills</title>
<style>
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --border: #30363d;
    --text: #c9d1d9;
    --text-muted: #8b949e;
    --terminal-bg: #0a0a0a;
    --terminal-border: #2a2a2e;
    --brand: #58a6ff;
    --hooks: #f0883e;
    --skills: #a371f7;
    --mcp: #58a6ff;
    --subagents: #3fb950;
    --task: #d2a8ff;
    --agent-tools: #ff7b72;
    --plugins: #f778ba;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    overflow-x: hidden;
  }
  a { color: var(--brand); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* ── Hero ── */
  .hero {
    text-align: center;
    padding: 2rem 1rem 1.5rem;
  }
  .hero h1 { font-size: 1.8rem; font-weight: 700; letter-spacing: -0.02em; }
  .hero p { color: var(--text-muted); margin-top: .3rem; font-size: .9rem; }

  /* ── Mode tabs ── */
  .mode-tabs {
    display: flex;
    justify-content: center;
    gap: .5rem;
    padding: .8rem;
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }
  .mode-tab {
    padding: .35rem .9rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    font-size: .82rem;
    transition: all .15s;
  }
  .mode-tab:hover { background: #1c2129; }
  .mode-tab.active { border-color: var(--brand); color: var(--brand); font-weight: 600; }

  /* ── Terminal chrome ── */
  .terminal-wrap {
    max-width: 960px;
    margin: 2rem auto;
    padding: 0 1rem;
  }
  .terminal {
    background: var(--terminal-bg);
    border: 1px solid var(--terminal-border);
    border-radius: 10px;
    overflow: hidden;
    position: relative;
  }
  .terminal-titlebar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #1a1a1e;
    border-bottom: 1px solid var(--terminal-border);
  }
  .traffic-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .traffic-dot.red    { background: #ff605c; }
  .traffic-dot.yellow { background: #ffbd44; }
  .traffic-dot.green  { background: #00ca4e; }
  .terminal-title {
    flex: 1;
    text-align: center;
    font-size: .75rem;
    color: var(--text-muted);
    font-weight: 500;
  }
  .terminal-body {
    padding: 1rem;
    overflow: auto;
    min-height: 200px;
    max-height: 80vh;
  }
  .terminal-body pre {
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
    font-size: clamp(6px, 1.2vw, 13px);
    line-height: 1.35;
    white-space: pre;
    color: var(--text);
    margin: 0;
  }

  /* ── SVG mode ── */
  .svg-wrap {
    max-width: 960px;
    margin: 2rem auto;
    padding: 0 1rem;
    display: none;
  }
  .svg-wrap.active { display: block; }
  .svg-container {
    background: var(--terminal-bg);
    border: 1px solid var(--terminal-border);
    border-radius: 10px;
    padding: 1.5rem;
    overflow: auto;
    text-align: center;
  }
  .svg-container svg { max-width: 100%; height: auto; }

  /* ── Controls ── */
  .controls-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: .8rem;
    padding: .6rem 1rem;
    flex-wrap: wrap;
  }
  .ctrl-btn {
    padding: .3rem .7rem;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    font-size: .78rem;
    font-family: monospace;
    transition: all .15s;
  }
  .ctrl-btn:hover { background: #1c2129; }
  .ctrl-btn.active { border-color: var(--brand); color: var(--brand); }
  .speed-label { font-size: .75rem; color: var(--text-muted); }
  .frame-counter {
    font-size: .7rem;
    color: var(--text-muted);
    font-family: monospace;
    min-width: 80px;
    text-align: center;
  }

  /* ── Section headers ── */
  .section-header {
    text-align: center;
    padding: 2rem 1rem .5rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
  }
  .section-sub {
    text-align: center;
    font-size: .8rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  /* ── Legend ── */
  .legend {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: .6rem;
    padding: .8rem 1rem;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: .3rem;
    font-size: .75rem;
  }
  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  /* ── Footer ── */
  footer {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--text-muted);
    font-size: .75rem;
    border-top: 1px solid var(--border);
    margin-top: 2rem;
  }

  /* ── Density ramp display ── */
  .density-ramp {
    text-align: center;
    padding: .5rem;
    font-family: monospace;
    font-size: .8rem;
    color: var(--text-muted);
    letter-spacing: .3em;
  }

  /* ── Hidden ── */
  .hidden { display: none !important; }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .hero h1 { font-size: 1.3rem; }
    .terminal-body pre { font-size: 5.5px; }
  }
</style>
</head>
<body>

<div class="hero">
  <h1>Agent Tools &amp; Skills</h1>
  <p>Claude Code changelog &mdash; animated visualization</p>
</div>

<div class="mode-tabs">
  <button class="mode-tab active" onclick="setMode('ascii')" id="tabAscii">ASCII Animation</button>
  <button class="mode-tab" onclick="setMode('svg')" id="tabSvg">SVG Diagrams</button>
</div>

<div class="legend">
  <div class="legend-item"><div class="legend-dot" style="background:var(--hooks)"></div>Hooks</div>
  <div class="legend-item"><div class="legend-dot" style="background:var(--skills)"></div>Skills</div>
  <div class="legend-item"><div class="legend-dot" style="background:var(--mcp)"></div>MCP</div>
  <div class="legend-item"><div class="legend-dot" style="background:var(--subagents)"></div>Subagents</div>
  <div class="legend-item"><div class="legend-dot" style="background:var(--task)"></div>Task Tool</div>
  <div class="legend-item"><div class="legend-dot" style="background:var(--agent-tools)"></div>Agent Tools</div>
  <div class="legend-item"><div class="legend-dot" style="background:var(--plugins)"></div>Plugins</div>
</div>

<!-- ═══ ASCII MODE ═══ -->
<div id="asciiMode">
  <div class="density-ramp">Character density: ${DENSITY_CHARS.join(" ")}</div>

  <div class="section-header">Interaction Graph</div>
  <div class="section-sub">How agent ecosystem objects interact</div>

  <div class="terminal-wrap">
    <div class="terminal">
      <div class="terminal-titlebar">
        <div class="traffic-dot red"></div>
        <div class="traffic-dot yellow"></div>
        <div class="traffic-dot green"></div>
        <div class="terminal-title">ghostty &mdash; agent-tools-interaction</div>
      </div>
      <div class="terminal-body">
        <pre id="interactionPre"></pre>
      </div>
    </div>
    <div class="controls-bar">
      <button class="ctrl-btn" id="playPauseBtn" onclick="togglePlay('interaction')">&#9654; Play</button>
      <button class="ctrl-btn" onclick="replay('interaction')">&#8634; Replay</button>
      <button class="ctrl-btn" onclick="cycleSpeed('interaction')">Speed: <span id="speedLabel-interaction">1x</span></button>
      <span class="frame-counter" id="frameCounter-interaction">0 / 0</span>
    </div>
  </div>

  <div class="section-header">Feature Timeline</div>
  <div class="section-sub">Major milestones in the agent tools evolution</div>

  <div class="terminal-wrap">
    <div class="terminal">
      <div class="terminal-titlebar">
        <div class="traffic-dot red"></div>
        <div class="traffic-dot yellow"></div>
        <div class="traffic-dot green"></div>
        <div class="terminal-title">ghostty &mdash; agent-tools-timeline</div>
      </div>
      <div class="terminal-body">
        <pre id="timelinePre"></pre>
      </div>
    </div>
    <div class="controls-bar">
      <button class="ctrl-btn" id="playPauseBtnTimeline" onclick="togglePlay('timeline')">&#9654; Play</button>
      <button class="ctrl-btn" onclick="replay('timeline')">&#8634; Replay</button>
      <button class="ctrl-btn" onclick="cycleSpeed('timeline')">Speed: <span id="speedLabel-timeline">1x</span></button>
      <span class="frame-counter" id="frameCounter-timeline">0 / 0</span>
    </div>
  </div>
</div>

<!-- ═══ SVG MODE ═══ -->
<div id="svgMode" class="hidden">
  <div class="section-header">Interaction Graph</div>
  <div class="svg-wrap active" id="svgInteractionWrap">
    <div class="svg-container">${svgInteraction}</div>
  </div>

  <div class="section-header">Feature Timeline</div>
  <div class="svg-wrap active" id="svgTimelineWrap">
    <div class="svg-container">${svgTimeline}</div>
  </div>
</div>

<footer>
  Generated by <code>generate.mjs</code> using
  <a href="https://github.com/vercel-labs/beautiful-mermaid" target="_blank">@vercel/beautiful-mermaid</a>
  + Ghostty-style ASCII animation.
  Source: <a href="https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md" target="_blank">CHANGELOG.md</a>
</footer>

<script>
// ════════════════════════════════════════════════════════════════════════════
//  Animation Engine — inspired by Ghostty's AnimationManager
// ════════════════════════════════════════════════════════════════════════════
class AnimationManager {
  constructor({ fps = 30, onFrame }) {
    this.fps = fps;
    this.frameLengthMs = 1000 / fps;
    this.onFrame = onFrame;
    this.running = false;
    this.rafId = null;
    this.lastTime = 0;
    this.accumulator = 0;
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this._tick();
  }
  pause() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
  updateFPS(fps) {
    this.fps = fps;
    this.frameLengthMs = 1000 / fps;
  }
  _tick() {
    if (!this.running) return;
    this.rafId = requestAnimationFrame((now) => {
      const delta = now - this.lastTime;
      this.lastTime = now;
      this.accumulator += delta;
      while (this.accumulator >= this.frameLengthMs) {
        this.accumulator -= this.frameLengthMs;
        this.onFrame();
      }
      this._tick();
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Frame Data (pre-rendered by generate.mjs)
// ════════════════════════════════════════════════════════════════════════════
const framesInteraction = {
  reveal: ${JSON.stringify(revealFramesInteraction)},
  shimmer: ${JSON.stringify(shimmerFramesInteraction)},
  hold: ${escapeForJS(colorizedInteraction)}
};
const framesTimeline = {
  reveal: ${JSON.stringify(revealFramesTimeline)},
  shimmer: ${JSON.stringify(shimmerFramesTimeline)},
  hold: ${escapeForJS(colorizedTimeline)}
};

// ════════════════════════════════════════════════════════════════════════════
//  State
// ════════════════════════════════════════════════════════════════════════════
const state = {
  interaction: {
    phase: 'reveal',  // 'reveal' | 'shimmer' | 'hold'
    frameIdx: 0,
    playing: false,
    speed: 1,
    manager: null,
    el: null,
  },
  timeline: {
    phase: 'reveal',
    frameIdx: 0,
    playing: false,
    speed: 1,
    manager: null,
    el: null,
  }
};

const SPEEDS = [1, 2, 4, 0.5];

function init() {
  state.interaction.el = document.getElementById('interactionPre');
  state.timeline.el = document.getElementById('timelinePre');

  // Show first frame
  state.interaction.el.innerHTML = framesInteraction.reveal[0];
  state.timeline.el.innerHTML = framesTimeline.reveal[0];
  updateCounters();

  // Create animation managers
  state.interaction.manager = new AnimationManager({
    fps: 24,
    onFrame: () => advanceFrame('interaction'),
  });
  state.timeline.manager = new AnimationManager({
    fps: 24,
    onFrame: () => advanceFrame('timeline'),
  });

  // Auto-play on visibility
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.target.id === 'interactionPre' && e.isIntersecting && !state.interaction.playing) {
        togglePlay('interaction');
      }
      if (e.target.id === 'timelinePre' && e.isIntersecting && !state.timeline.playing) {
        togglePlay('timeline');
      }
    });
  }, { threshold: 0.3 });
  observer.observe(state.interaction.el);
  observer.observe(state.timeline.el);

  // Pause on tab blur
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.interaction.playing) state.interaction.manager.pause();
      if (state.timeline.playing) state.timeline.manager.pause();
    } else {
      if (state.interaction.playing) state.interaction.manager.start();
      if (state.timeline.playing) state.timeline.manager.start();
    }
  });
}

function getFrameData(which) {
  const d = which === 'interaction' ? framesInteraction : framesTimeline;
  const s = state[which];
  if (s.phase === 'reveal') return d.reveal;
  if (s.phase === 'shimmer') return d.shimmer;
  return [d.hold];
}

function getTotalFrames(which) {
  const d = which === 'interaction' ? framesInteraction : framesTimeline;
  return d.reveal.length + d.shimmer.length;
}

function advanceFrame(which) {
  const s = state[which];
  const d = which === 'interaction' ? framesInteraction : framesTimeline;

  s.frameIdx++;

  if (s.phase === 'reveal') {
    if (s.frameIdx >= d.reveal.length) {
      s.phase = 'shimmer';
      s.frameIdx = 0;
    }
  } else if (s.phase === 'shimmer') {
    if (s.frameIdx >= d.shimmer.length) {
      // Loop shimmer
      s.frameIdx = 0;
    }
  }

  const frames = getFrameData(which);
  const idx = Math.min(s.frameIdx, frames.length - 1);
  s.el.innerHTML = frames[idx];
  updateCounters();
}

function togglePlay(which) {
  const s = state[which];
  s.playing = !s.playing;
  if (s.playing) {
    s.manager.updateFPS(24 * s.speed);
    s.manager.start();
  } else {
    s.manager.pause();
  }
  updateButtons(which);
}

function replay(which) {
  const s = state[which];
  s.phase = 'reveal';
  s.frameIdx = 0;
  s.playing = true;
  s.manager.updateFPS(24 * s.speed);
  s.manager.start();
  updateButtons(which);
}

function cycleSpeed(which) {
  const s = state[which];
  const idx = SPEEDS.indexOf(s.speed);
  s.speed = SPEEDS[(idx + 1) % SPEEDS.length];
  if (s.playing) s.manager.updateFPS(24 * s.speed);
  document.getElementById('speedLabel-' + which).textContent = s.speed + 'x';
}

function updateButtons(which) {
  const s = state[which];
  const btn = which === 'interaction'
    ? document.getElementById('playPauseBtn')
    : document.getElementById('playPauseBtnTimeline');
  btn.innerHTML = s.playing ? '&#9646;&#9646; Pause' : '&#9654; Play';
}

function updateCounters() {
  for (const which of ['interaction', 'timeline']) {
    const s = state[which];
    const d = which === 'interaction' ? framesInteraction : framesTimeline;
    const total = d.reveal.length + d.shimmer.length;
    const current = s.phase === 'reveal' ? s.frameIdx : d.reveal.length + s.frameIdx;
    document.getElementById('frameCounter-' + which).textContent =
      current + ' / ' + total;
  }
}

// ── Mode switching ──
function setMode(mode) {
  document.getElementById('asciiMode').classList.toggle('hidden', mode !== 'ascii');
  document.getElementById('svgMode').classList.toggle('hidden', mode !== 'svg');
  document.getElementById('tabAscii').classList.toggle('active', mode === 'ascii');
  document.getElementById('tabSvg').classList.toggle('active', mode === 'svg');
}

// ── Init ──
document.addEventListener('DOMContentLoaded', init);
</script>
</body>
</html>`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
