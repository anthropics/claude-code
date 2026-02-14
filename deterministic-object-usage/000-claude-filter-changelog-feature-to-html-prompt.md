# Deterministic Changelog-Feature-to-Visual Skill

> A reusable, deterministic process for extracting any feature track from a
> changelog and rendering it as an interactive, animated visualization.

---

## 0. Purpose

Given **any** project's `CHANGELOG.md` (or equivalent versioned release notes)
and a **feature filter** (e.g. "MCP", "auth", "billing"), produce:

1. A semver-ordered, filterable, interactive visual (HTML/Mermaid/ASCII art).
2. Object/param/interaction reference tables.
3. Animated diagrams showing evolution over time.

This document makes the process **deterministic** -- the same inputs always
produce the same structural output -- and **reusable** as a Claude Code skill,
Vercel agent skill, or standalone CLI pipeline.

---

## 1. Toolchain Reference

| Tool | Role | URL |
|------|------|-----|
| **beautiful-mermaid** | Themed Mermaid SVG/ASCII rendering with CSS animation | `github.com/vercel-labs/beautiful-mermaid` |
| **agent-browser** | Browser automation CLI for AI agents (compact DOM refs) | `agent-browser.dev` |
| **Next.js** | App framework for full-stack interactive deployment | `github.com/vercel/next.js` |
| **coding-agent-template** | Sandbox-based AI coding agent scaffold | `github.com/vercel-labs/coding-agent-template` |
| **agent-skills** | Packaged skill instructions (SKILL.md + scripts/) | `github.com/vercel-labs/agent-skills` |
| **skills CLI** | Install/manage skills across 35+ coding agents | `github.com/vercel-labs/skills` |
| **Ghostty** | Terminal emulator with 60fps pre-rendered ASCII animation | `ghostty.org` |

---

## 2. Input Schema (Deterministic Contract)

```yaml
# --- deterministic-changelog-filter.input.yaml ---
source:
  type: url | file_path
  value: "https://raw.githubusercontent.com/{owner}/{repo}/refs/heads/main/CHANGELOG.md"

filter:
  # Keywords to match changelog entries against.
  # Entries matching ANY keyword are included.
  keywords:
    - "MCP"
    - "agent"
    - "subagent"
    - "skill"
    - "hook"
    - "SDK"
    - "tool"
  # Optional: exclude entries matching these patterns
  exclude_patterns:
    - "typo fix"
    - "docs only"

output:
  format: html | nextjs | ascii  # target rendering format
  file_prefix: "004"              # semver-style prefix for the output file
  feature_slug: "claude-agent-mcp" # kebab-case feature identifier
  directory: "deterministic-object-usage/"

rendering:
  engine: beautiful-mermaid       # mermaid renderer
  animation: ghostty-ascii        # animation style
  theme: dark                     # dark | light | auto
  fps: 15                         # target animation fps (2-60)
  color_map:                      # category -> color
    mcp: "#58a6ff"
    agent: "#7ee787"
    hook: "#f78166"
    skill: "#d2a8ff"
    sdk: "#ff7b72"
    tool: "#79c0ff"
```

---

## 3. The Deterministic Process (8 Steps)

### Step 1: Fetch Source Changelog

```
INPUT:  source.value
OUTPUT: raw_changelog: string
METHOD: WebFetch(url) | Read(file_path)
```

Retrieve the raw markdown text. No transformation yet.

### Step 2: Parse Semver Sections

```
INPUT:  raw_changelog
OUTPUT: releases[]: { version: semver, date: string, entries: string[] }
METHOD: Regex split on /^## \[?(\d+\.\d+\.\d+)\]?\s*[-—]\s*(.+)$/gm
```

Each release becomes a structured object. Entries are the bullet points
under each version header.

### Step 3: Filter by Feature Keywords

```
INPUT:  releases[], filter.keywords[], filter.exclude_patterns[]
OUTPUT: filtered_entries[]: { version, date, text, categories[] }
METHOD:
  FOR each entry in each release:
    IF entry.text matches ANY keyword (case-insensitive):
      IF entry.text does NOT match any exclude_pattern:
        categories = matched keywords (lowercased, deduped)
        EMIT { version, date, text, categories }
```

This is the core filtering step. The category assignment is deterministic:
a keyword match maps 1:1 to a category tag.

### Step 4: Group into Eras

```
INPUT:  filtered_entries[]
OUTPUT: eras[]: { prefix: "major.minor", label, entries[] }
METHOD:
  Group by major.minor prefix (e.g., "0.2", "1.0", "2.0", "2.1")
  Label format: "v{prefix}.x — {Era Name}"
  Era names derived from first major feature in that series
```

### Step 5: Extract Object Definitions

```
INPUT:  filtered_entries[]
OUTPUT: objects[]: { name, introduced, category, params, interacts_with[] }
METHOD:
  Scan entries for:
    - New named objects (e.g., "MCPServer", "TaskTool", "HookConfig")
    - Parameter additions (e.g., "timeout", "model", "permissionMode")
    - Interaction mentions (e.g., "X now works with Y")
  Build object graph incrementally across versions
```

### Step 6: Generate Mermaid Diagrams

```
INPUT:  objects[], eras[]
OUTPUT: diagrams[]: { type, title, mermaid_source }
METHOD:
  Generate these diagram types:
    1. flowchart TD  — Architecture overview (objects + connections)
    2. sequenceDiagram — Interaction sequence (prompt → tool → result)
    3. timeline        — Feature evolution per era
    4. classDiagram    — Object/param/relationship reference
  Apply beautiful-mermaid theming:
    %%{init: {'theme':'dark', 'themeVariables': {...color_map}}}%%
```

### Step 7: Render Output

```
INPUT:  eras[], objects[], diagrams[], rendering config
OUTPUT: rendered file (HTML | Next.js page | ASCII)
```

#### 7a. HTML Output (self-contained)

```
Structure:
  <ascii-banner>        — Ghostty-style animated ASCII art header
  <controls>            — Filter buttons (one per category) + view switcher
  <stats-bar>           — Animated counters per category
  <timeline-view>       — Vertical timeline with era headers, version dots, tags
  <diagram-view>        — Mermaid diagrams (rendered via CDN or beautiful-mermaid)
  <objects-view>        — Interactive table with expandable param blocks
  <script>              — Data arrays + render engine + animation loop
```

#### 7b. Next.js + beautiful-mermaid Output

```
Structure:
  app/
    page.tsx             — Main layout with filter state (React useState)
    components/
      AsciiBanner.tsx    — Ghostty-style requestAnimationFrame animation
      Timeline.tsx       — Virtualized list of version entries
      MermaidDiagram.tsx — beautiful-mermaid React wrapper
      ObjectTable.tsx    — Expandable object reference
    data/
      changelog.json     — Pre-parsed filtered data (step 3-5 output)
    styles/
      theme.css          — CSS variables matching color_map
```

#### 7c. ASCII Output (Ghostty-optimized)

```
Structure:
  - Pre-rendered frames[] array
  - Each frame is a fixed-width text block (80-120 cols)
  - Animation via terminal escape sequences:
      \033[H     — cursor home
      \033[2J    — clear screen
      \033[38;2;R;G;Bm — 24-bit color
  - Frame rate controlled by sleep interval (1000/fps ms)
  - Transitions: fade (opacity steps), slide (offset shift), pulse (symbol swap)
```

### Step 8: Validate Output

```
INPUT:  rendered file
OUTPUT: validation report
METHOD:
  1. Count rendered entries == count filtered entries
  2. All categories represented in filter controls
  3. Mermaid diagrams parse without error
  4. No broken internal references (object names match)
  5. Animation frames render without flicker (if ASCII)
```

---

## 4. Ghostty-Style ASCII Animation Specification

### 4.1 Frame Structure

```
┌─────────────────────────────────────────────┐
│  {s1} Object A  {arrow} {s2} Object B      │
│       ╱                        ╲            │
│  {s1} Object C        {s2} Object D        │
│       ╲                        ╱            │
│         ╚═══ {label} ═══▸ {s3} Result ═══╝ │
└─────────────────────────────────────────────┘

Where:
  {s1}, {s2}, {s3} = symbols that cycle per frame: ◉ ● ○ ◎ ◆ ◇ ◈
  {arrow}          = connector that animates: ──▸ ━━▶ ══▷ ──▹
  {label}          = contextual text (e.g., "hooks", "MCP", "tools")
```

### 4.2 Animation Strategies

| Strategy | Description | FPS Range | Use Case |
|----------|-------------|-----------|----------|
| **Symbol pulse** | Cycle symbol glyphs (◉→●→○→◎) | 2-4 fps | Subtle activity indicator |
| **Arrow flow** | Animate connector direction chars | 4-8 fps | Data flow visualization |
| **Frame swap** | Full pre-rendered frame replacement | 8-15 fps | Complex scene changes |
| **Color cycle** | ANSI 24-bit color transitions | 15-30 fps | Terminal-only highlights |
| **Smooth scroll** | Line-by-line content shift | 30-60 fps | Ghostty-grade animation |

### 4.3 Efficiency Rules

1. **Pre-render all frames** at build time, not runtime.
2. **Diff-based updates**: only repaint changed characters.
3. **Respect terminal capabilities**: degrade gracefully (256-color → 16-color → mono).
4. **Cap at 15fps for web/HTML**: `setInterval(render, 66)` -- higher fps wastes CPU in browser context.
5. **Use `requestAnimationFrame`** for Next.js/React, `setInterval` for raw HTML.

---

## 5. Reusable Skill Definition

### 5.1 As a Claude Code Skill

```markdown
<!-- .claude/skills/changelog-to-visual.md -->
---
name: changelog-to-visual
description: Filter a changelog by feature keywords and render as interactive visual
agent: general-purpose
model: sonnet
---

# Changelog to Visual Skill

When the user asks to visualize changelog features, follow this process:

1. Fetch the changelog from the provided URL or file path
2. Parse into semver sections using regex: /^## \[?(\d+\.\d+\.\d+)\]?/
3. Filter entries by the specified keywords (case-insensitive match)
4. Categorize each entry by which keywords matched
5. Group into eras by major.minor version prefix
6. Extract object definitions (named entities, params, interactions)
7. Generate Mermaid diagrams: architecture flowchart, sequence diagram, timeline, class diagram
8. Render as self-contained HTML with:
   - ASCII art banner (Ghostty-style animated)
   - Filter controls per category
   - Stats counters
   - Timeline view with scroll animations
   - Diagram view with beautiful-mermaid theming
   - Object reference table with expandable params
9. Use dark theme with monospace font
10. Apply color-mix() for tag backgrounds at 20% opacity
```

### 5.2 As a Vercel Agent Skill (SKILL.md)

```markdown
<!-- SKILL.md -->
---
name: changelog-to-visual
description: Extract feature tracks from changelogs and render as interactive Mermaid + ASCII visuals
---

## Instructions

You are a changelog visualization specialist. When activated:

1. **Input**: Accept a changelog URL/path and feature keywords
2. **Parse**: Split by semver headers, filter by keywords
3. **Model**: Build object graph (entities, params, relationships per version)
4. **Render**: Output as Next.js page using beautiful-mermaid for diagrams
5. **Animate**: Add Ghostty-style ASCII banner with requestAnimationFrame

### File Structure to Generate

- `app/page.tsx` — Main page with filter state
- `app/data/changelog.json` — Pre-parsed filtered data
- `app/components/Timeline.tsx` — Version entry list
- `app/components/MermaidDiagram.tsx` — beautiful-mermaid wrapper
- `app/components/AsciiAnimation.tsx` — Ghostty-style frame animator

### Dependencies

```json
{
  "dependencies": {
    "next": "latest",
    "react": "^19",
    "beautiful-mermaid": "latest"
  }
}
```
```

### 5.3 As a CLI Pipeline (agent-browser + bash)

```bash
#!/usr/bin/env bash
# changelog-to-visual.sh
# Usage: ./changelog-to-visual.sh <changelog_url> <keyword1> [keyword2] ...

set -euo pipefail

CHANGELOG_URL="$1"
shift
KEYWORDS=("$@")

# Step 1: Fetch
curl -sL "$CHANGELOG_URL" > /tmp/changelog_raw.md

# Step 2-5: Parse + Filter + Categorize + Group
# (delegated to Claude Code via SDK)
claude -p "
  Read /tmp/changelog_raw.md.
  Filter for entries matching: ${KEYWORDS[*]}.
  Output JSON: {eras: [{prefix, label, entries: [{version, text, categories}]}]}
" --output-format json > /tmp/changelog_filtered.json

# Step 6: Generate Mermaid
claude -p "
  Read /tmp/changelog_filtered.json.
  Generate 4 Mermaid diagrams: flowchart, sequence, timeline, classDiagram.
  Output as JSON array of {type, title, source} objects.
" --output-format json > /tmp/changelog_diagrams.json

# Step 7: Render HTML
claude -p "
  Read /tmp/changelog_filtered.json and /tmp/changelog_diagrams.json.
  Generate a self-contained HTML file following the spec in
  deterministic-object-usage/000-claude-filter-changelog-feature-to-html-prompt.md
  Step 7a. Write to /tmp/changelog_visual.html.
"

# Step 8: Validate
claude -p "
  Read /tmp/changelog_visual.html.
  Verify: entry count matches, all categories present, mermaid parses, no broken refs.
  Output validation report as text.
"

echo "Output: /tmp/changelog_visual.html"

# Optional: open with agent-browser for verification
# npx agent-browser navigate "file:///tmp/changelog_visual.html"
```

---

## 6. Beautiful-Mermaid + Ghostty Integration Pattern

### 6.1 Mermaid Theming via beautiful-mermaid

```typescript
import { renderMermaid } from 'beautiful-mermaid';

const svg = await renderMermaid(diagramSource, {
  theme: 'vercel-dark', // or any Shiki-compatible theme
  colors: {
    background: '#0d1117',
    foreground: '#c9d1d9',
    // additional overrides use color-mix() internally
  },
  animate: true,  // enable CSS keyframe + SMIL arrow animations
});
```

### 6.2 Ghostty ASCII in React

```tsx
// AsciiAnimation.tsx
'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  frames: string[];
  fps?: number;
  colors?: Record<string, string>;
}

export function AsciiAnimation({ frames, fps = 4, colors }: Props) {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [frames.length, fps]);

  return (
    <pre
      ref={ref}
      style={{
        fontFamily: 'var(--mono)',
        color: colors?.foreground ?? '#7ee787',
        textAlign: 'center',
        lineHeight: 1.15,
        fontSize: '9px',
      }}
    >
      {frames[index]}
    </pre>
  );
}
```

### 6.3 Terminal ASCII (Ghostty-native, 60fps capable)

```typescript
// ghostty-render.ts — for terminal-only output
const ESC = '\x1b';
const CURSOR_HOME = `${ESC}[H`;
const CLEAR = `${ESC}[2J`;
const color = (r: number, g: number, b: number) =>
  `${ESC}[38;2;${r};${g};${b}m`;
const RESET = `${ESC}[0m`;

function renderTerminalAnimation(frames: string[], fps: number) {
  let i = 0;
  process.stdout.write(CLEAR);

  setInterval(() => {
    process.stdout.write(CURSOR_HOME);
    process.stdout.write(color(126, 231, 135)); // agent-green
    process.stdout.write(frames[i]);
    process.stdout.write(RESET);
    i = (i + 1) % frames.length;
  }, 1000 / fps);
}
```

---

## 7. Extending to Other Features

To reuse this process for a different feature (e.g., "authentication" in a
different project):

1. **Change `filter.keywords`** in the input schema.
2. **Update `rendering.color_map`** to match new categories.
3. **Adjust era labels** if the project uses different versioning conventions.
4. **Run the same 8-step process.** The output structure is identical.

### Example: Filtering for "auth" features

```yaml
filter:
  keywords: ["auth", "OAuth", "login", "SSO", "JWT", "session", "credential"]
  exclude_patterns: ["typo"]
output:
  file_prefix: "005"
  feature_slug: "authentication-evolution"
rendering:
  color_map:
    auth: "#58a6ff"
    oauth: "#7ee787"
    session: "#f78166"
    credential: "#d2a8ff"
```

The same skill, diagrams, and animation engine apply. Only the data changes.

---

## 8. Determinism Guarantees

| Property | Guarantee |
|----------|-----------|
| **Same source + same keywords** | Produces identical filtered entries |
| **Category assignment** | 1:1 keyword-to-category mapping, lowercased |
| **Era grouping** | Deterministic major.minor prefix grouping |
| **Object extraction** | Ordered by first-appearance version |
| **Diagram structure** | Same objects produce same Mermaid source |
| **Rendering** | Same data + same theme = same pixel output |
| **Animation frames** | Pre-rendered, indexed, deterministic cycle |

The only non-deterministic element is the AI-generated **era labels** and
**object interaction descriptions** in Step 4-5. To make those deterministic,
provide them explicitly in the input schema or use a fixed mapping file.

---

## 9. File Naming Convention

```
deterministic-object-usage/
  000-claude-filter-changelog-feature-to-html-prompt.md   ← this file (process spec)
  004-claude-agent-mcp.html                               ← rendered output for agent/MCP feature
  005-claude-authentication.html                          ← (future) auth feature track
  006-claude-plugin-system.html                           ← (future) plugin feature track
```

Prefix numbering follows the project's semver-adjacent labeling:
- `000` = meta/process documents
- `001-003` = reserved for foundational specs
- `004+` = feature-specific visualizations

---

## 10. Quick Start

```bash
# 1. Install the skill (if using skills CLI)
npx @anthropic-ai/skills install changelog-to-visual

# 2. Or use directly with Claude Code
claude "Visualize the MCP feature track from this changelog:
  https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md
  Filter for: MCP, agent, hook, skill, SDK, tool
  Output as: deterministic-object-usage/004-claude-agent-mcp.html
  Follow the process in: deterministic-object-usage/000-claude-filter-changelog-feature-to-html-prompt.md"

# 3. Or use the CLI pipeline
./changelog-to-visual.sh \
  "https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md" \
  MCP agent hook skill SDK tool
```
