---
name: deterministic-viz
description: Generate beautiful Mermaid + Ghostty-style ASCII animation visualizations from CHANGELOG.md feature evolution
license: MIT
metadata:
  author: jadecli-experimental
  version: "0.1.0"
  tags:
    - visualization
    - mermaid
    - ascii-animation
    - changelog
    - deterministic
---

# deterministic-viz

A reusable skill for generating **beautiful Mermaid diagrams** and **Ghostty-style ASCII animations** that visualize how a feature evolves through a project's changelog.

## What This Skill Does

Given a feature name and a CHANGELOG.md file, this skill executes a **deterministic 7-step pipeline** to produce:

1. **Animated SVG diagrams** via `@vercel/beautiful-mermaid` (architecture, sequence, class, ER)
2. **Ghostty-style ASCII art animation** at 24-60fps with density-ramp morphing transitions
3. **Interactive Next.js app** with era-based filtering, timeline, and theme switching
4. **Self-verifying output** testable via `agent-browser`

## The 7-Step Deterministic Process

### Step 1: FETCH — Parse Changelog

Read the project's CHANGELOG.md and parse it into structured version blocks.

```
Input:  Raw CHANGELOG.md text
Output: VersionBlock[] — { version, date, changes: { type, text, identifiers }[] }
```

Each change is classified as `added`, `fixed`, `changed`, or `breaking`.

### Step 2: FILTER — Match Feature Keywords

Apply 4-tier keyword matching to isolate entries relevant to the target feature:

| Tier | Strategy | Example |
|------|----------|---------|
| 1 | Exact substring match | "subagent" matches "Add subagent spawning" |
| 2 | Context co-occurrence | "parallel" only matches if a primary keyword is also present |
| 3 | Identifier match | Backtick-wrapped `SubagentStop` matches keyword "subagent" |
| 4 | Exclusion | "unrelated-feature" entries filtered out even if keywords match |

### Step 3: EXPLORE — Discover Object Model

Scan the codebase for types, interfaces, configs, and parameters related to the feature. Collect identifiers for the architecture diagram.

### Step 4: ERA — Define Evolutionary Milestones

Group versions into eras that represent the feature's evolutionary phases:

- **Foundation** — Initial introduction and core mechanics
- **Customization** — Configuration options and user control
- **Enhancement** — Advanced features, integrations, new capabilities
- **Teams/Scale** — Multi-user, enterprise, and performance features

### Step 5: MERMAID — Generate Diagram Definitions

Produce mermaid source strings for:
- **Architecture flowchart** — System objects and their relationships
- **Sequence diagram** — Interaction lifecycle
- **Per-era progressive flowcharts** — Feature growth over time (used for animation)

### Step 6: ANIMATE — Render ASCII Frames

Generate Ghostty-style animation frames:

1. Render each era's mermaid diagram as ASCII using `renderMermaidAscii()`
2. Generate morphing transition frames between eras using the density ramp:
   ```
   · ~ o x + = * % $ @
   (lightest → heaviest)
   ```
3. Characters fade in/out through the ramp during transitions
4. Package as `AnimationSequence` with target FPS and loop config

### Step 7: SERVE — Next.js Visualization App

Render everything in a Next.js app with:
- `AsciiPlayer` — requestAnimationFrame-based Ghostty-style playback
- `MermaidView` — beautiful-mermaid SVG/ASCII toggle rendering
- `EraTimeline` — interactive timeline with era filtering
- Theme switching (ghostty-dark, vercel-light, tokyo-night)

## Usage

### As a Claude Code Skill

```bash
# Install the skill
npx skills add jadecli-experimental/claude-code

# Or manually copy SKILL.md to your project
cp SKILL.md .claude/skills/deterministic-viz/SKILL.md
```

Then ask Claude Code:

```
Visualize the "hooks" feature evolution from CHANGELOG.md using deterministic-viz
```

### As a Next.js App

```bash
cd deterministic-object-usage/viz
npm install
npm run dev
# Open http://localhost:3000
```

### Via API

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "changelog": "## 1.0.0\n### Added\n- Add hooks support",
    "config": {
      "name": "Hooks",
      "keywords": ["hook", "PreToolUse", "PostToolUse"],
      "eras": [{ "id": "foundation", "label": "Foundation", "color": "#58a6ff", "accent": "#79c0ff", "versions": ["1.0.0"] }]
    }
  }'
```

### Testing with agent-browser

```bash
# Start the dev server
npm run dev &

# Verify with agent-browser (AI-readable snapshot)
agent-browser open http://localhost:3000
agent-browser snapshot -i

# Check specific elements
agent-browser find text "Ghostty-Style ASCII Animation"
agent-browser screenshot viz-output.png --full
```

## Feature Keyword Tables

Pre-configured keyword sets for common Claude Code features:

| Feature | Primary Keywords |
|---------|-----------------|
| **Subagents** | `subagent, sub-agent, Task tool, agent type, subagent_type, max_turns, SubagentStop` |
| **Hooks** | `hook, PreToolUse, PostToolUse, SessionStart, SessionEnd, SubagentStop` |
| **MCP** | `MCP, Model Context Protocol, mcp server, SSE, stdio, OAuth` |
| **Plugins** | `plugin, marketplace, plugin install, plugin system` |
| **Skills** | `skill, slash command, /skills, skill frontmatter, SKILL.md` |
| **Vim Mode** | `vim, vim mode, vim bindings, vim motion, vim keybinding` |
| **SDK** | `SDK, claude-agent-sdk, --print, -p mode, headless, Agent class` |

## Architecture

```
deterministic-object-usage/viz/
├── app/
│   ├── layout.tsx              # Root layout with Ghostty-dark theme
│   ├── page.tsx                # Landing: ASCII player + diagrams + timeline
│   ├── globals.css             # Tailwind CSS + Ghostty scrollbar + color classes
│   └── api/generate/route.ts   # POST endpoint for dynamic generation
├── components/
│   ├── ascii-player.tsx        # Ghostty-style rAF animation player
│   ├── mermaid-view.tsx        # beautiful-mermaid SVG/ASCII renderer
│   └── era-timeline.tsx        # Interactive era-filtered timeline
├── lib/
│   ├── types.ts                # Core domain types
│   ├── themes.ts               # 3 themes + density ramps + mermaid color bridge
│   ├── changelog-parser.ts     # CHANGELOG.md parser + 4-tier feature filter
│   ├── mermaid-generator.ts    # Mermaid source generation from parsed data
│   └── ascii-animator.ts       # Ghostty-style frame engine + density morphing
├── SKILL.md                    # This file (installable via npx skills)
├── package.json                # Next.js 15 + beautiful-mermaid + agent-browser
└── next.config.js              # Standalone output for deployment
```

## Key Technologies

| Technology | Purpose | Link |
|-----------|---------|------|
| `@vercel/beautiful-mermaid` | Colored SVG + ASCII mermaid rendering with 16 themes | [GitHub](https://github.com/vercel-labs/beautiful-mermaid) |
| Ghostty animation style | Frame-by-frame ASCII at 24-60fps via requestAnimationFrame | [ghostty.org](https://ghostty.org/) |
| Next.js 15 | React framework with App Router and API routes | [nextjs.org](https://nextjs.org/) |
| agent-browser | AI-agent browser automation for self-verification | [agent-browser.dev](https://agent-browser.dev/) |
| Vercel Skills | Skill packaging and distribution ecosystem | [GitHub](https://github.com/vercel-labs/skills) |

## Density Ramp Reference

The Ghostty character density ramp maps luminance levels to visual weight:

```
Scale │ Char │ Weight
──────┼──────┼────────
  0   │  ·   │ Lightest
  1   │  ~   │
  2   │  o   │
  3   │  x   │
  4   │  +   │
  5   │  =   │ Medium
  6   │  *   │
  7   │  %   │
  8   │  $   │
  9   │  @   │ Heaviest
```

During transitions between era keyframes, characters morph through this ramp:
- **Fade out**: `@` → `%` → `*` → `=` → `+` → `·` → ` ` (space)
- **Fade in**: ` ` → `·` → `+` → `=` → `*` → `%` → `@`
- **Cross-fade**: Interpolate between source and target positions

## Color Modes

### HTML (Web)
Characters are wrapped in `<span class="b">` (blue), `<span class="g">` (green), `<span class="y">` (yellow), `<span class="r">` (red) for era-specific coloring.

### ANSI (Terminal)
Standard ANSI escape codes for terminal output (when used outside the browser).

### None
Plain ASCII without color markup.
