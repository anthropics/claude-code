---
name: changelog-visual
description: >
  Generate animated ASCII + SVG visualizations from a CHANGELOG.md,
  filtered by feature domain. Uses @vercel/beautiful-mermaid for diagram
  rendering and Ghostty-style progressive-reveal animation.
user-invocable: true
argument-hint: <feature-domain> [--output <file>]
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - WebFetch
---

# Changelog Visual — Animated Feature Domain Visualization

You are a visualization pipeline that transforms a CHANGELOG.md into an
animated ASCII + SVG interactive HTML page for a given feature domain.

## Stack

- **@vercel/beautiful-mermaid** — renders mermaid syntax to SVG (animated,
  themed) and ASCII (Unicode box-drawing)
- **Ghostty-style animation** — pre-rendered frames played via
  `requestAnimationFrame` with character-density mapping (`· ~ o x + = * % $ @`)
- **Self-contained HTML** — zero external dependencies, works offline

## Process

Follow the deterministic 8-step process defined in
`deterministic-object-usage/000-claude-filter-changelog-feature-to-html-prompt.md`:

### Step 1: Parse CHANGELOG
Read the CHANGELOG.md and parse into semver-grouped version objects.

### Step 2: Filter by feature domain
The user provides a feature domain name and keywords.
Filter entries by keyword match, section match, and transitive relevance.

### Step 3: Categorise
Assign category slugs to each entry based on matched keywords.

### Step 4: Extract objects & params
Build an object model for each category: `{label, firstVer, events, params, frontmatter}`.

### Step 5: Build interaction graph
Identify edges between categories from cross-category entries.
Express the graph as **mermaid syntax** (two versions):
- Rich version with HTML labels for SVG rendering
- Plain version for ASCII rendering

### Step 6: Build timeline graph
Express the major milestones as a left-to-right mermaid flowchart.

### Step 7: Generate via pipeline
Run the build pipeline:
```bash
cd deterministic-object-usage
npm install   # ensures @vercel/beautiful-mermaid is available
node generate.mjs --output <NNN>-<slug>.html
```

If the mermaid definitions need updating, edit `generate.mjs` to:
1. Update `INTERACTION_GRAPH` and `INTERACTION_GRAPH_ASCII` constants
2. Update `TIMELINE_GRAPH` and `TIMELINE_GRAPH_ASCII` constants
3. Update `COLORS` and `WORD_COLORS` maps for the new categories
4. Re-run `node generate.mjs --output <file>`

### Step 8: Verify
Open the generated HTML and confirm:
- ASCII animation plays with progressive reveal + shimmer loop
- SVG mode shows beautiful-mermaid animated diagrams
- Category colors render correctly
- Play/Pause/Replay/Speed controls work
- Page works offline (no external fetches)

## Output modes

The generated HTML supports two viewing modes:
- **ASCII Animation** — Ghostty-style terminal chrome with animated reveal
- **SVG Diagrams** — beautiful-mermaid rendered SVGs with rank-by-rank animation

## Customization

### Themes
beautiful-mermaid ships 16 themes. Change in `generate.mjs`:
```js
const svgInteraction = await renderMermaid(diagram, {
  ...THEMES["catppuccin-mocha"],  // or any other theme
  animate: true,
});
```

### Animation speed
Default is 24 FPS. The HTML player supports 0.5x / 1x / 2x / 4x speed.

### Character density ramp
The Ghostty-style mapping can be customized:
```js
const DENSITY_CHARS = ["·", "~", "o", "x", "+", "=", "*", "%", "$", "@"];
```

## Example invocations

```
/changelog-visual Agent Tools & Skills
/changelog-visual IDE Integrations --output 004-ide-integrations.html
/changelog-visual Security & Permissions --output 002-security.html
```

## Files

| File | Purpose |
|------|---------|
| `deterministic-object-usage/generate.mjs` | Build pipeline script |
| `deterministic-object-usage/package.json` | Dependencies (@vercel/beautiful-mermaid) |
| `deterministic-object-usage/000-*.md` | Deterministic process template |
| `deterministic-object-usage/NNN-*.html` | Generated visualizations |
