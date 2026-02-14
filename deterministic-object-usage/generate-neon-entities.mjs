#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// generate-neon-entities.mjs — Neon + Vercel Entity Sequence Diagrams
//
// Generates 7 entity-perspective sequence diagrams as animated ASCII + SVG.
// Each diagram shows the system from one entity's perspective.
//
// Usage:
//   node generate-neon-entities.mjs
//   node generate-neon-entities.mjs --output custom-name.html
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
    : "005-neon-vercel-entities.html";

// ─── Entity color palette ────────────────────────────────────────────────────
const COLORS = {
  developer:  { hex: "#f0883e", label: "Developer" },
  git:        { hex: "#a371f7", label: "Git Branch" },
  pr:         { hex: "#58a6ff", label: "Pull Request" },
  neon:       { hex: "#3fb950", label: "Neon Postgres" },
  vercel:     { hex: "#ffffff", label: "Vercel" },
  workflow:   { hex: "#d2a8ff", label: "GitHub Actions" },
  schema:     { hex: "#ff7b72", label: "Database Schema" },
};

// ─── Mermaid Diagrams — 7 Entity Perspectives ───────────────────────────────

// Full system overview — the "god view"
const OVERVIEW_GRAPH = `graph TD
    DEV["<b>Developer</b><br/><i>push, merge, close</i>"]
    GIT["<b>Git Branch</b><br/><i>main, feat/*, dev</i>"]
    PR["<b>Pull Request</b><br/><i>#N open/close</i>"]
    GHA["<b>GitHub Actions</b><br/><i>4 workflows</i>"]
    NEON["<b>Neon Postgres</b><br/><i>branch per PR</i>"]
    VERCEL["<b>Vercel</b><br/><i>preview + prod</i>"]
    SCHEMA["<b>Database Schema</b><br/><i>diff, migrate</i>"]

    DEV -->|push| GIT
    DEV -->|open/close| PR
    GIT -->|head_branch| PR
    PR -->|triggers| GHA
    GHA -->|create/delete| NEON
    GHA -->|build/deploy| VERCEL
    NEON -->|DATABASE_URL| VERCEL
    NEON -->|contains| SCHEMA
    GHA -->|schema diff| SCHEMA
    VERCEL -->|dispatch| GHA`;

const OVERVIEW_GRAPH_ASCII = `graph TD
    DEV[Developer]
    GIT[Git Branch]
    PR[Pull Request]
    GHA[GitHub Actions]
    NEON[Neon Postgres]
    VERCEL[Vercel]
    SCHEMA[Database Schema]

    DEV -->|push| GIT
    DEV -->|open/close| PR
    GIT -->|head| PR
    PR -->|triggers| GHA
    GHA -->|create/delete| NEON
    GHA -->|build/deploy| VERCEL
    NEON -->|DB_URL| VERCEL
    NEON -->|contains| SCHEMA
    GHA -->|diff| SCHEMA
    VERCEL -->|dispatch| GHA`;

// Sequence: Developer perspective
const DEV_SEQUENCE = `sequenceDiagram
    actor Dev as Developer
    participant Git as Git Branch
    participant PR as Pull Request
    participant GHA as GitHub Actions
    participant Neon as Neon Postgres
    participant Vercel as Vercel

    Dev->>Git: checkout -b feat/x
    Dev->>Git: push origin feat/x
    Dev->>PR: Open PR #42
    PR-->>GHA: trigger preview
    GHA-->>Neon: create preview/pr-42
    Neon-->>GHA: db_url
    GHA-->>Vercel: deploy preview
    GHA-->>PR: comment URL
    Dev->>Git: push (iterate)
    Git-->>GHA: rebuild
    Dev->>PR: Merge
    PR-->>GHA: cleanup
    GHA-->>Neon: delete branch`;

const DEV_SEQUENCE_ASCII = DEV_SEQUENCE;

// Sequence: Neon perspective
const NEON_SEQUENCE = `sequenceDiagram
    participant GHA as GitHub Actions
    participant API as Neon API
    participant Branch as Neon Branch
    participant Schema as Schema
    participant Vercel as Vercel

    GHA->>API: POST create branch
    API->>Branch: fork from main
    Note over Branch: copy-on-write
    API-->>GHA: db_url, branch_id
    GHA->>Vercel: inject DATABASE_URL
    Vercel->>Branch: run migrations
    Branch->>Schema: ALTER TABLE
    GHA->>API: schema diff
    API->>Schema: compare branches
    Schema-->>GHA: diff result
    GHA->>API: DELETE branch
    API->>Branch: destroy`;

const NEON_SEQUENCE_ASCII = NEON_SEQUENCE;

// Sequence: Vercel perspective
const VERCEL_SEQUENCE = `sequenceDiagram
    participant GHA as GitHub Actions
    participant CLI as Vercel CLI
    participant Vercel as Vercel Platform
    participant App as Application
    participant Neon as Neon Branch

    GHA->>CLI: vercel pull
    CLI->>Vercel: fetch config
    GHA->>CLI: vercel build
    Note over CLI: DATABASE_URL injected
    CLI->>App: build application
    App->>Neon: connect (migrate)
    GHA->>CLI: vercel deploy
    CLI->>Vercel: upload artifacts
    Vercel-->>GHA: preview URL
    Vercel->>App: serve preview
    App->>Neon: queries (pooled)
    Vercel-->>GHA: dispatch success`;

const VERCEL_SEQUENCE_ASCII = VERCEL_SEQUENCE;

// Sequence: Pull Request perspective
const PR_SEQUENCE = `sequenceDiagram
    participant Dev as Developer
    participant PR as Pull Request
    participant W1 as Preview WF
    participant W2 as Cleanup WF
    participant Neon as Neon
    participant Vercel as Vercel

    Dev->>PR: Open PR #42
    PR->>W1: trigger (opened)
    W1->>Neon: create branch
    W1->>Neon: schema diff
    W1-->>PR: diff comment
    W1->>Vercel: deploy preview
    W1-->>PR: URL comment
    Dev->>PR: Push commits
    PR->>W1: trigger (synchronize)
    W1->>Vercel: rebuild
    Dev->>PR: Merge
    PR->>W2: trigger (closed)
    W2->>Neon: delete branch`;

const PR_SEQUENCE_ASCII = PR_SEQUENCE;

// Lifecycle flow: branch naming
const LIFECYCLE_GRAPH = `graph LR
    M["main<br/>production"] -->|PR open| P["preview/pr-N<br/>ephemeral"]
    M -->|push main| D["dev<br/>persistent"]
    P -->|PR close| X["deleted"]
    D -->|push main| R["reset from main"]
    R -->|continues| D`;

const LIFECYCLE_GRAPH_ASCII = `graph LR
    M[main] -->|PR open| P[preview/pr-N]
    M -->|push| D[dev]
    P -->|close| X[deleted]
    D -->|reset| R[from main]
    R -->|continues| D`;

// Data flow: connection strings
const DATAFLOW_GRAPH = `graph LR
    API["Neon API<br/>NEON_API_KEY"] -->|create branch| ACT["create-branch-action"]
    ACT -->|outputs| OUT["db_url<br/>db_url_pooled<br/>branch_id"]
    OUT -->|needs.neon-branch| JOB["vercel-preview job"]
    JOB -->|env vars| BUILD["vercel build"]
    BUILD -->|DATABASE_URL| MIG["Migrations<br/>direct conn"]
    BUILD -->|DATABASE_URL_POOLED| RT["Runtime<br/>pooled conn"]`;

const DATAFLOW_GRAPH_ASCII = `graph LR
    API[Neon API] -->|create| ACT[branch-action]
    ACT -->|outputs| OUT[db_url + pooled]
    OUT -->|needs| JOB[preview job]
    JOB -->|env| BUILD[vercel build]
    BUILD -->|direct| MIG[Migrations]
    BUILD -->|pooled| RT[Runtime]`;

// ─── Word → color mappings for ASCII colorization ───────────────────────────
const WORD_COLORS = {
  Developer:    COLORS.developer.hex,
  Dev:          COLORS.developer.hex,
  Git:          COLORS.git.hex,
  Branch:       COLORS.git.hex,
  "Pull":       COLORS.pr.hex,
  Request:      COLORS.pr.hex,
  PR:           COLORS.pr.hex,
  Neon:         COLORS.neon.hex,
  Postgres:     COLORS.neon.hex,
  "preview/pr": COLORS.neon.hex,
  "copy-on-write": COLORS.neon.hex,
  Vercel:       COLORS.vercel.hex,
  GitHub:       COLORS.workflow.hex,
  Actions:      COLORS.workflow.hex,
  Schema:       COLORS.schema.hex,
  "schema":     COLORS.schema.hex,
  "DATABASE_URL": COLORS.neon.hex,
  "db_url":     COLORS.neon.hex,
  "main":       COLORS.git.hex,
  "dev":        COLORS.neon.hex,
  deploy:       COLORS.vercel.hex,
  preview:      COLORS.vercel.hex,
  production:   COLORS.workflow.hex,
  "create":     COLORS.neon.hex,
  "delete":     COLORS.schema.hex,
  "diff":       COLORS.schema.hex,
  "build":      COLORS.vercel.hex,
  "merge":      COLORS.developer.hex,
  "push":       COLORS.developer.hex,
  "trigger":    COLORS.workflow.hex,
  "Migrations": COLORS.schema.hex,
  "Runtime":    COLORS.neon.hex,
  "pooled":     COLORS.neon.hex,
  "direct":     COLORS.schema.hex,
  CLI:          COLORS.vercel.hex,
  API:          COLORS.neon.hex,
  "WF":         COLORS.workflow.hex,
  "Preview":    COLORS.vercel.hex,
  "Cleanup":    COLORS.schema.hex,
  "reset":      COLORS.workflow.hex,
  "ephemeral":  COLORS.neon.hex,
  "persistent": COLORS.neon.hex,
  "Application": COLORS.vercel.hex,
  App:          COLORS.vercel.hex,
  Platform:     COLORS.vercel.hex,
};

// ─── Character density ramp (Ghostty-style) ─────────────────────────────────
const DENSITY_CHARS = ["·", "~", "o", "x", "+", "=", "*", "%", "$", "@"];

// ─── Colorize ASCII ─────────────────────────────────────────────────────────
function colorizeAscii(ascii) {
  let html = ascii
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const keywords = Object.keys(WORD_COLORS).sort((a, b) => b.length - a.length);
  for (const kw of keywords) {
    const color = WORD_COLORS[kw];
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(
      new RegExp(`(${escaped})`, "g"),
      `<span style="color:${color}">$1</span>`
    );
  }
  return html;
}

// ─── Progressive-reveal frames ──────────────────────────────────────────────
function generateFrames(asciiLines, totalFrames = 50) {
  const lines = asciiLines.split("\n");
  const height = lines.length;
  const width = Math.max(...lines.map((l) => l.length));
  const padded = lines.map((l) => l.padEnd(width));

  const charGrid = padded.map((line) =>
    [...line].map((ch) => (ch !== " " ? 1 : 0))
  );

  const totalChars = charGrid.flat().reduce((a, b) => a + b, 0);
  const charsPerFrame = Math.max(1, Math.ceil(totalChars / (totalFrames - 10)));

  const revealOrder = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (charGrid[y][x]) {
        revealOrder.push({ x, y });
      }
    }
  }

  const frames = [];

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

  const fullAscii = padded.join("\n");
  for (let f = 0; f < 10; f++) {
    frames.push(fullAscii);
  }

  return frames;
}

// ─── Shimmer frames ─────────────────────────────────────────────────────────
function generateShimmerFrames(asciiLines, numFrames = 20) {
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

// ─── Diagram definitions ────────────────────────────────────────────────────
const DIAGRAMS = [
  {
    id: "overview",
    title: "System Overview",
    subtitle: "All entities and their relationships",
    rich: OVERVIEW_GRAPH,
    ascii: OVERVIEW_GRAPH_ASCII,
    type: "graph",
  },
  {
    id: "developer",
    title: "Developer Perspective",
    subtitle: "What the developer sees across the full lifecycle",
    rich: DEV_SEQUENCE,
    ascii: DEV_SEQUENCE_ASCII,
    type: "sequence",
  },
  {
    id: "pr",
    title: "Pull Request Perspective",
    subtitle: "The PR as orchestrator of the branching lifecycle",
    rich: PR_SEQUENCE,
    ascii: PR_SEQUENCE_ASCII,
    type: "sequence",
  },
  {
    id: "neon",
    title: "Neon Branch Perspective",
    subtitle: "Database branch lifecycle from creation to deletion",
    rich: NEON_SEQUENCE,
    ascii: NEON_SEQUENCE_ASCII,
    type: "sequence",
  },
  {
    id: "vercel",
    title: "Vercel Deploy Perspective",
    subtitle: "Receiving builds, serving previews, dispatching events",
    rich: VERCEL_SEQUENCE,
    ascii: VERCEL_SEQUENCE_ASCII,
    type: "sequence",
  },
  {
    id: "lifecycle",
    title: "Branch Lifecycle",
    subtitle: "Neon branch naming convention and lifecycle",
    rich: LIFECYCLE_GRAPH,
    ascii: LIFECYCLE_GRAPH_ASCII,
    type: "graph",
  },
  {
    id: "dataflow",
    title: "Connection String Data Flow",
    subtitle: "How DATABASE_URL flows from Neon to your application",
    rich: DATAFLOW_GRAPH,
    ascii: DATAFLOW_GRAPH_ASCII,
    type: "graph",
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Rendering 7 entity diagrams...\n");

  const rendered = [];

  for (const d of DIAGRAMS) {
    console.log(`  ${d.id}: ${d.title}`);

    // Render SVG
    let svg;
    try {
      svg = await renderMermaid(d.rich, {
        ...THEMES["vercel-dark"],
        animate: true,
      });
    } catch (err) {
      console.warn(`    SVG render failed for ${d.id}: ${err.message}`);
      svg = `<pre style="color:#ff7b72">[SVG render error: ${err.message}]</pre>`;
    }

    // Render ASCII
    let ascii;
    try {
      ascii = renderMermaidAscii(d.ascii, { useAscii: false });
    } catch (err) {
      console.warn(`    ASCII render failed for ${d.id}, using raw`);
      ascii = d.ascii;
    }

    console.log(`    ASCII preview:\n${ascii.split("\n").slice(0, 3).join("\n")}...\n`);

    // Generate frames
    const revealFrames = generateFrames(ascii, 50);
    const shimmerFrames = generateShimmerFrames(ascii, 20);
    const colorized = colorizeAscii(ascii);

    rendered.push({
      ...d,
      svg,
      ascii,
      colorized,
      revealFrames: revealFrames.map(colorizeAscii),
      shimmerFrames: shimmerFrames.map(colorizeAscii),
    });
  }

  // Build HTML
  console.log("Building HTML...");
  const html = buildHTML(rendered);

  const outPath = resolve(__dirname, outputFile);
  writeFileSync(outPath, html, "utf-8");
  console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
}

// ─── HTML Template ───────────────────────────────────────────────────────────
function buildHTML(diagrams) {
  const escapeForJS = (s) => JSON.stringify(s);

  const diagramTabs = diagrams
    .map(
      (d, i) =>
        `<button class="diagram-tab${i === 0 ? " active" : ""}" onclick="selectDiagram('${d.id}')" id="tab-${d.id}">${d.title}</button>`
    )
    .join("\n    ");

  const diagramDataJS = diagrams
    .map(
      (d) => `
    "${d.id}": {
      title: ${escapeForJS(d.title)},
      subtitle: ${escapeForJS(d.subtitle)},
      svg: ${escapeForJS(d.svg)},
      reveal: ${JSON.stringify(d.revealFrames)},
      shimmer: ${JSON.stringify(d.shimmerFrames)},
      hold: ${escapeForJS(d.colorized)}
    }`
    )
    .join(",");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Neon + Vercel — Entity Sequence Diagrams</title>
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
    --developer: ${COLORS.developer.hex};
    --git: ${COLORS.git.hex};
    --pr: ${COLORS.pr.hex};
    --neon: ${COLORS.neon.hex};
    --vercel: ${COLORS.vercel.hex};
    --workflow: ${COLORS.workflow.hex};
    --schema: ${COLORS.schema.hex};
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

  .hero {
    text-align: center;
    padding: 2rem 1rem 1rem;
  }
  .hero h1 { font-size: 1.8rem; font-weight: 700; letter-spacing: -0.02em; }
  .hero p { color: var(--text-muted); margin-top: .3rem; font-size: .9rem; }

  .mode-tabs {
    display: flex;
    justify-content: center;
    gap: .5rem;
    padding: .6rem;
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }
  .mode-tab {
    padding: .3rem .8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    font-size: .8rem;
    transition: all .15s;
  }
  .mode-tab:hover { background: #1c2129; }
  .mode-tab.active { border-color: var(--brand); color: var(--brand); font-weight: 600; }

  .diagram-tabs {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: .4rem;
    padding: .6rem 1rem;
  }
  .diagram-tab {
    padding: .25rem .6rem;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: .72rem;
    transition: all .15s;
  }
  .diagram-tab:hover { color: var(--text); background: var(--surface); }
  .diagram-tab.active { border-color: var(--neon); color: var(--neon); font-weight: 600; }

  .legend {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: .6rem;
    padding: .6rem 1rem;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: .3rem;
    font-size: .72rem;
  }
  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .terminal-wrap {
    max-width: 1000px;
    margin: 1.5rem auto;
    padding: 0 1rem;
  }
  .terminal {
    background: var(--terminal-bg);
    border: 1px solid var(--terminal-border);
    border-radius: 10px;
    overflow: hidden;
  }
  .terminal-titlebar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #1a1a1e;
    border-bottom: 1px solid var(--terminal-border);
  }
  .traffic-dot { width: 12px; height: 12px; border-radius: 50%; }
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
    font-size: clamp(7px, 1.1vw, 13px);
    line-height: 1.35;
    white-space: pre;
    color: var(--text);
    margin: 0;
  }

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
  .frame-counter {
    font-size: .7rem;
    color: var(--text-muted);
    font-family: monospace;
    min-width: 80px;
    text-align: center;
  }

  .svg-wrap {
    max-width: 1000px;
    margin: 1.5rem auto;
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

  .section-header {
    text-align: center;
    padding: 1.5rem 1rem .3rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
  }
  .section-sub {
    text-align: center;
    font-size: .8rem;
    color: var(--text-muted);
    margin-bottom: .8rem;
  }

  .density-ramp {
    text-align: center;
    padding: .4rem;
    font-family: monospace;
    font-size: .75rem;
    color: var(--text-muted);
    letter-spacing: .3em;
  }

  footer {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--text-muted);
    font-size: .75rem;
    border-top: 1px solid var(--border);
    margin-top: 2rem;
  }

  .hidden { display: none !important; }

  @media (max-width: 600px) {
    .hero h1 { font-size: 1.3rem; }
    .terminal-body pre { font-size: 5.5px; }
  }
</style>
</head>
<body>

<div class="hero">
  <h1>Neon + Vercel — Entity Sequence Diagrams</h1>
  <p>Database-per-branch workflow from every entity's perspective</p>
</div>

<div class="mode-tabs">
  <button class="mode-tab active" onclick="setMode('ascii')" id="tabAscii">ASCII Animation</button>
  <button class="mode-tab" onclick="setMode('svg')" id="tabSvg">SVG Diagrams</button>
</div>

<div class="diagram-tabs">
  ${diagramTabs}
</div>

<div class="legend">
  <div class="legend-item"><div class="legend-dot" style="background:var(--developer)"></div>Developer</div>
  <div class="legend-item"><div class="legend-dot" style="background:var(--git)"></div>Git Branch</div>
  <div class="legend-item"><div class="legend-dot" style="background:var(--pr)"></div>Pull Request</div>
  <div class="legend-item"><div class="legend-dot" style="background:var(--neon)"></div>Neon Postgres</div>
  <div class="legend-item"><div class="legend-dot" style="background:var(--vercel)"></div>Vercel</div>
  <div class="legend-item"><div class="legend-dot" style="background:var(--workflow)"></div>GitHub Actions</div>
  <div class="legend-item"><div class="legend-dot" style="background:var(--schema)"></div>Database Schema</div>
</div>

<!-- ASCII mode -->
<div id="asciiMode">
  <div class="density-ramp">density: ${DENSITY_CHARS.join(" ")}</div>

  <div class="section-header" id="asciiTitle">System Overview</div>
  <div class="section-sub" id="asciiSub">All entities and their relationships</div>

  <div class="terminal-wrap">
    <div class="terminal">
      <div class="terminal-titlebar">
        <div class="traffic-dot red"></div>
        <div class="traffic-dot yellow"></div>
        <div class="traffic-dot green"></div>
        <div class="terminal-title" id="terminalTitle">neon-vercel &mdash; overview</div>
      </div>
      <div class="terminal-body">
        <pre id="diagramPre"></pre>
      </div>
    </div>
    <div class="controls-bar">
      <button class="ctrl-btn" id="playPauseBtn" onclick="togglePlay()">&#9654; Play</button>
      <button class="ctrl-btn" onclick="replayAnim()">&#8634; Replay</button>
      <button class="ctrl-btn" onclick="cycleSpeed()">Speed: <span id="speedLabel">1x</span></button>
      <span class="frame-counter" id="frameCounter">0 / 0</span>
    </div>
  </div>
</div>

<!-- SVG mode -->
<div id="svgMode" class="hidden">
  <div class="section-header" id="svgTitle">System Overview</div>
  <div class="section-sub" id="svgSub">All entities and their relationships</div>
  <div class="svg-wrap active" id="svgWrap">
    <div class="svg-container" id="svgContainer"></div>
  </div>
</div>

<footer>
  Generated by <code>generate-neon-entities.mjs</code> using
  <a href="https://github.com/vercel-labs/beautiful-mermaid" target="_blank">@vercel/beautiful-mermaid</a>
  + Ghostty-style ASCII animation.
</footer>

<script>
// ═══════════════════════════════════════════════════════════════════════════
class AnimationManager {
  constructor({ fps = 24, onFrame }) {
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

// ═══════════════════════════════════════════════════════════════════════════
const DIAGRAMS = {${diagramDataJS}
};

const SPEEDS = [1, 2, 4, 0.5];

const state = {
  current: "overview",
  mode: "ascii",
  phase: "reveal",
  frameIdx: 0,
  playing: false,
  speed: 1,
  manager: null,
  el: null,
};

function init() {
  state.el = document.getElementById("diagramPre");
  state.manager = new AnimationManager({
    fps: 24,
    onFrame: advanceFrame,
  });

  loadDiagram("overview");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.target.id === "diagramPre" && e.isIntersecting && !state.playing) {
        togglePlay();
      }
    });
  }, { threshold: 0.3 });
  observer.observe(state.el);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (state.playing) state.manager.pause();
    } else {
      if (state.playing) state.manager.start();
    }
  });
}

function loadDiagram(id) {
  state.current = id;
  state.phase = "reveal";
  state.frameIdx = 0;

  const d = DIAGRAMS[id];

  // Update titles
  document.getElementById("asciiTitle").textContent = d.title;
  document.getElementById("asciiSub").textContent = d.subtitle;
  document.getElementById("svgTitle").textContent = d.title;
  document.getElementById("svgSub").textContent = d.subtitle;
  document.getElementById("terminalTitle").textContent = "neon-vercel — " + id;

  // Update ASCII
  if (d.reveal.length > 0) {
    state.el.innerHTML = d.reveal[0];
  }

  // Update SVG
  document.getElementById("svgContainer").innerHTML = d.svg;

  // Update tab highlighting
  document.querySelectorAll(".diagram-tab").forEach((t) => t.classList.remove("active"));
  const tab = document.getElementById("tab-" + id);
  if (tab) tab.classList.add("active");

  updateCounter();

  // Restart animation
  if (state.playing) {
    state.manager.pause();
    state.playing = false;
    updatePlayBtn();
  }
}

function selectDiagram(id) {
  loadDiagram(id);
}

function advanceFrame() {
  const d = DIAGRAMS[state.current];
  state.frameIdx++;

  if (state.phase === "reveal") {
    if (state.frameIdx >= d.reveal.length) {
      state.phase = "shimmer";
      state.frameIdx = 0;
    }
  } else if (state.phase === "shimmer") {
    if (state.frameIdx >= d.shimmer.length) {
      state.frameIdx = 0;
    }
  }

  const frames = state.phase === "reveal" ? d.reveal : d.shimmer;
  const idx = Math.min(state.frameIdx, frames.length - 1);
  state.el.innerHTML = frames[idx];
  updateCounter();
}

function togglePlay() {
  state.playing = !state.playing;
  if (state.playing) {
    state.manager.updateFPS(24 * state.speed);
    state.manager.start();
  } else {
    state.manager.pause();
  }
  updatePlayBtn();
}

function replayAnim() {
  state.phase = "reveal";
  state.frameIdx = 0;
  state.playing = true;
  state.manager.updateFPS(24 * state.speed);
  state.manager.start();
  updatePlayBtn();
}

function cycleSpeed() {
  const idx = SPEEDS.indexOf(state.speed);
  state.speed = SPEEDS[(idx + 1) % SPEEDS.length];
  if (state.playing) state.manager.updateFPS(24 * state.speed);
  document.getElementById("speedLabel").textContent = state.speed + "x";
}

function updatePlayBtn() {
  const btn = document.getElementById("playPauseBtn");
  btn.innerHTML = state.playing ? "&#9646;&#9646; Pause" : "&#9654; Play";
}

function updateCounter() {
  const d = DIAGRAMS[state.current];
  const total = d.reveal.length + d.shimmer.length;
  const current = state.phase === "reveal"
    ? state.frameIdx
    : d.reveal.length + state.frameIdx;
  document.getElementById("frameCounter").textContent = current + " / " + total;
}

function setMode(mode) {
  state.mode = mode;
  document.getElementById("asciiMode").classList.toggle("hidden", mode !== "ascii");
  document.getElementById("svgMode").classList.toggle("hidden", mode !== "svg");
  document.getElementById("tabAscii").classList.toggle("active", mode === "ascii");
  document.getElementById("tabSvg").classList.toggle("active", mode === "svg");
}

document.addEventListener("DOMContentLoaded", init);
</script>
</body>
</html>`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
